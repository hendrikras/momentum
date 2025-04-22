const shapes = {
  rect: [
    { x: 0, y: 0 },
    { x: config.world.blockSize, y: 0 },
    { x: config.world.blockSize, y: config.world.blockSize },
    { x: 0, y: config.world.blockSize }
  ],
  slopeTL: [
    { x: config.world.blockSize, y: 0 },
    { x: config.world.blockSize, y: config.world.blockSize },
    { x: 0, y: config.world.blockSize }
  ],
  slopeTR: [
    { x: 0, y: 0 },
    { x: config.world.blockSize, y: config.world.blockSize },
    { x: 0, y: config.world.blockSize }
  ],
  slopeBL: [
    { x: 0, y: 0 },
    { x: config.world.blockSize, y: config.world.blockSize },
    { x: config.world.blockSize, y: 0 }
  ],
  slopeBR: [
    { x: 0, y: 0 },
    { x: config.world.blockSize, y: 0 },
    { x: 0, y: config.world.blockSize }
  ],
  seesaw: [
    { x: -config.world.blockSize * 1.5, y: -config.world.blockSize * 0.15 },
    { x: config.world.blockSize * 1.5, y: -config.world.blockSize * 0.15 },
    { x: config.world.blockSize * 1.5, y: config.world.blockSize * 0.15 },
    { x: -config.world.blockSize * 1.5, y: config.world.blockSize * 0.15 }
  ]
}

const blockTypes = {
  "0": {
    points: shapes.rect
  },
  "+": {
    points: shapes.rect
  },
  "<": {
    points: shapes.slopeTL
  },
  ">": {
    points: shapes.slopeTR
  },
  "\\": {
    points: shapes.slopeBL
  },
  "/": {
    points: shapes.slopeBR
  },
  "p": {
    points: shapes.rect
  },
  "a": {
    points: [
      { x: 0, y: 0 },
      { x: 800, y: 0 },
      { x: 800, y: 50 },
      { x: 0, y: 50 }
    ]
  },
  "b": {
    points: [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 400 },
      { x: 0, y: 400 }
    ]
  },
  "m": {
    points: shapes.rect,
    isMoving: true,
    moveDistance: 100,
    moveSpeed: 1
  },
  "s": {
    points: shapes.seesaw,
    isPivoting: true,
    maxAngle: 0.3, // Maximum rotation in radians (about 17 degrees)
    angularDamping: 0.05, // How quickly the seesaw slows down
    pivotFriction: 0.01 // How easily the seesaw rotates
  },
  "r": {
    points: shapes.rect,
    isRope: true,
    segmentsPerBlock: 5, // Number of segments per block height
    segmentRadius: 5 // Radius of each rope segment
  }
};

class Block extends Body {
  constructor(type, x, y) {
    if(!blockTypes[type]) throw new Error(`Block of type '${type}' does not exist (level ${level}). Define a new block type or remove it from the level bitmap.`);
    let stats = blockTypes[type];

    let newBody;
    let ropeSegments = [];
    let constraints = [];
    let isRope = type === 'r';
    let isPivoting = stats.isPivoting || false;
    // Store these variables temporarily
    let tempSegmentsPerBlock, tempSegmentRadius, tempAnchorX, tempAnchorY;

    if (isRope) {
      // Create an anchor point
      newBody = Bodies.circle(x, y, stats.segmentRadius * 2, {
        isStatic: true,
        collisionFilter: { group: -1 } // Prevent collision with other objects
      });

      // Store these values temporarily instead of using this
      tempSegmentsPerBlock = stats.segmentsPerBlock;
      tempSegmentRadius = stats.segmentRadius || 5;
      tempAnchorX = x;
      tempAnchorY = y;
    } else if (isPivoting) {
      newBody = Bodies.fromVertices(x, y, stats.points, {
        isStatic: false,
        friction: 0.5,
        frictionAir: stats.pivotFriction,
        density: 0.1,
        restitution: 0.2,
      });
    } else {
      newBody = Bodies.fromVertices(x, y, stats.points, { isStatic: true });
      const { min, max } = newBody.bounds;
      Matter.Body.setPosition(newBody, {
        x: x + (newBody.position.x - min.x),
        y: y + (newBody.position.y - min.y)
      });
    }

    super(newBody, "block");

    this.t = type;
    this.isRope = isRope;
    this.isPivoting = isPivoting;
    this.ropeSegments = ropeSegments;
    this.constraints = constraints;
    this.supports = [];
    this.angleCollision = null;
    this.isMoving = stats.isMoving || false;
    this.moveDistance = stats.moveDistance || 0;
    this.moveSpeed = stats.moveSpeed || 0;
    this.initialY = y;
    this.movingUp = true;

    if (isPivoting) {
      this.maxAngle = stats.maxAngle;
      this.constraint = Matter.Constraint.create({
        bodyA: this.body,
        pointA: { x: 0, y: 0 },
        pointB: { x, y },
        stiffness: 1,
        length: 0
      });
      Matter.World.add(world, this.constraint);
      this.body.angularDamping = stats.angularDamping;
      this.lastPlayerPosition = null;
      this.playerOnSeesaw = false;
      this.seesawEquilibrium = 0;
      // Use the seesawEquilibrium to gradually return to equilibrium position
      Matter.Events.on(engine, 'afterUpdate', () => {
        if (!this.playerOnSeesaw && Math.abs(this.body.angularVelocity) < 0.001) {
          this.seesawEquilibrium = this.body.angle;
        }
      });
    }

    if (isRope) {
      this.segmentsPerBlock = tempSegmentsPerBlock;
      this.segmentRadius = tempSegmentRadius;
      this.anchorX = tempAnchorX;
      this.anchorY = tempAnchorY;
      
      // Add custom properties to identify this as a rope block
      this.body.label = 'ropeAnchor';
      this.body.ropeBlock = this;
      
      // Register this rope block with the level manager
      // Don't create rope segments here - let connectRopeBlocks handle it
      if (typeof registerRopeBlock === 'function') {
        registerRopeBlock(this);
      }
      
      // Add a method to connect this rope to another rope below it
      this.connectToRopeBelow = function(ropeBlockBelow) {
        if (!this.lastRopeSegment || !ropeBlockBelow || !ropeBlockBelow.body) return;
        
        // Create a constraint between this rope's end and the rope below's anchor
        const newConstraint = Constraint.create({
          bodyA: this.lastRopeSegment,
          bodyB: ropeBlockBelow.body,
          length: 10,
          stiffness: 0.9
        });
        
        World.add(world, newConstraint);
        this.constraints.push(newConstraint);
        
        // Mark both ropes as connected
        this.connectedBelow = ropeBlockBelow;
        ropeBlockBelow.connectedAbove = this;
      };
    }

    configBlockEvents(this);
  }
  draw() {
    if (this.isHidden) return;
    switch(this.t){
      case "0":
      case "<":
      case ">":
      case "\\":
      case "/":
        fill(50);
        let pos = this.body.position;
        let angle = this.body.angle;
        beginShape();
        for (var i = 0; i < this.body.vertices.length; i++) {
          vertex(this.body.vertices[i].x, this.body.vertices[i].y);
        }
        endShape();
      break;
      case "+":
        fill(0, 225, 255);
        ellipse(this.body.position.x, this.body.position.y, config.world.blockSize, config.world.blockSize);
      break;
      case "m":
        fill(100, 100, 255);  // Light blue color for moving platforms
        beginShape();
        for (var i = 0; i < this.body.vertices.length; i++) {
          vertex(this.body.vertices[i].x, this.body.vertices[i].y);
        }
        endShape();
      break;
      case "s":
        // Draw the seesaw platform with more detail
        push();

        // Draw the base/fulcrum
        fill(80, 80, 80);
        let baseWidth = 20;
        let baseHeight = 30;
        triangle(
          this.body.position.x, this.body.position.y - 5,
          this.body.position.x - baseWidth/2, this.body.position.y + baseHeight - 5,
          this.body.position.x + baseWidth/2, this.body.position.y + baseHeight - 5
        );

        // Draw the platform
        push();
        translate(this.body.position.x, this.body.position.y);
        rotate(this.body.angle);

        // Draw wooden planks for the platform - centered properly
        rectMode(CENTER); // This ensures the rectangle is drawn centered at (0,0)
        fill(150, 75, 0);
        rect(0, 0, config.world.blockSize * 3, config.world.blockSize * 0.3);

        // Add wood grain details
        stroke(120, 60, 0);
        strokeWeight(1);
        for (let i = -1.4; i <= 1.4; i += 0.2) {
          line(
            i * config.world.blockSize, -config.world.blockSize * 0.15,
            i * config.world.blockSize, config.world.blockSize * 0.15
          );
        }

        // Add end caps to make it look more finished
        fill(130, 65, 0);
        noStroke();
        rectMode(CORNER); // Switch back to corner mode for the end caps
        rect(-config.world.blockSize * 1.5, -config.world.blockSize * 0.15,
             config.world.blockSize * 0.1, config.world.blockSize * 0.3);
        rect(config.world.blockSize * 1.4, -config.world.blockSize * 0.15,
             config.world.blockSize * 0.1, config.world.blockSize * 0.3);

        pop();

        // Draw the pivot point
        fill(100);
        noStroke();
        ellipse(this.body.position.x, this.body.position.y, 10, 10);

        pop();
      break;
      case "r":
        // Only draw the rope if this is the top rope in a group
        // or if it's a standalone rope
        if (this.isTopRope || (!this.isTopRope && !this.isBottomRope)) {
          stroke(139, 69, 19); // Brown rope color
          strokeWeight(this.segmentRadius * 1.5);
          noFill();
          beginShape();
          vertex(this.body.position.x, this.body.position.y);
          for (let segment of this.ropeSegments) {
            vertex(segment.position.x, segment.position.y);
          }
          endShape();
          
          // Draw the anchor point
          fill(101, 67, 33); // Darker brown for anchor
          noStroke();
          ellipse(this.body.position.x, this.body.position.y, this.segmentRadius * 4, this.segmentRadius * 4);
        }
      break
    }
  }

  run() {
    this.emit("update");
    this.update();

    let col = Collision.collides(this.body, player.body);
    if (col && col.supports) {
      this.emit("collide", [this, player]);
      this.angleCollision = Math.atan2(col.tangent.y, col.tangent.x) / (Math.PI / 180);
      this.supports = col.supports;

      // If this is a pivoting platform, handle seesaw physics
      if (this.isPivoting) {
        this.playerOnSeesaw = true;

        // Calculate player's position relative to the pivot point
        let relativeX = player.body.position.x - this.body.position.x;

        // Store the player's last position on the seesaw
        this.lastPlayerPosition = {
          x: relativeX,
          y: player.body.position.y - this.body.position.y
        };

        // Calculate torque based on player position and mass
        // Torque = Force × Distance from pivot
        let playerMass = player.body.mass;
        let torque = relativeX * playerMass * 0.001;

        // Apply torque to the seesaw
        Matter.Body.setAngularVelocity(
          this.body,
          this.body.angularVelocity + torque
        );

        // Apply a counterforce to the player to keep them on the seesaw
        // This simulates the platform pushing back against the player
        let angle = this.body.angle;
        let surfaceNormal = {
          x: -Math.sin(angle),
          y: Math.cos(angle)
        };

        // Calculate the force needed to keep the player on the platform
        // This is proportional to the seesaw's angular velocity
        let stabilizingForce = this.body.angularVelocity * 0.1;

        // Apply the force to the player
        Matter.Body.applyForce(
          player.body,
          player.body.position,
          {
            x: surfaceNormal.x * stabilizingForce,
            y: surfaceNormal.y * stabilizingForce
          }
        );
      }
    } else {
      this.supports = [];
      this.angleCollision = null;

      // If player was on seesaw but is no longer, apply inertia
      if (this.isPivoting && this.playerOnSeesaw) {
        this.playerOnSeesaw = false;

        // Apply a small restoring force to gradually return to equilibrium
        // This simulates the seesaw settling after the player jumps off
        let currentAngle = this.body.angle;
        let restoringTorque = -currentAngle * 0.01;

        Matter.Body.setAngularVelocity(
          this.body,
          this.body.angularVelocity + restoringTorque
        );
      }
    }
  }

  update() {
    if (this.isMoving) {
      let currentY = this.body.position.y;
      if (this.movingUp) {
        if (currentY > this.initialY - this.moveDistance) {
          bd.setPosition(this.body, { x: this.body.position.x, y: currentY - this.moveSpeed });
        } else {
          this.movingUp = false;
        }
      } else {
        if (currentY < this.initialY) {
          bd.setPosition(this.body, { x: this.body.position.x, y: currentY + this.moveSpeed });
        } else {
          this.movingUp = true;
        }
      }
    }

    // For pivoting platforms, limit the rotation angle
    if (this.isPivoting && this.maxAngle) {
      let currentAngle = this.body.angle % (Math.PI * 2);
      if (currentAngle > Math.PI) currentAngle -= Math.PI * 2;
      if (currentAngle < -Math.PI) currentAngle += Math.PI * 2;

      if (Math.abs(currentAngle) > this.maxAngle) {
        // If exceeding max angle, set to max and reduce angular velocity
        let newAngle = currentAngle > 0 ? this.maxAngle : -this.maxAngle;
        Matter.Body.setAngle(this.body, newAngle);
        Matter.Body.setAngularVelocity(this.body, this.body.angularVelocity * 0.5);
      }
    }
  }
// Add this function to the Block class or to the connectRopeBlocks function
 createRopeSegments(topRope, bottomRope) {
  // Calculate total rope length based on the distance between top and bottom anchors
  const totalLength = bottomRope.anchorY + config.world.blockSize - topRope.anchorY;

  // Calculate total number of segments
  const totalSegments = Math.max(5, Math.floor(totalLength / 20)); // Ensure at least 5 segments

  // Create rope segments
  let ropeSegments = [];
  let constraints = [];
  const segmentLength = totalLength / totalSegments;
  const segmentRadius = 5; // Small radius for rope segments

// Create all segments
for (let i = 0; i < totalSegments; i++) {
  let segment = Bodies.circle(
    topRope.anchorX,
    topRope.anchorY + (i + 0.5) * segmentLength,
    topRope.segmentRadius,
    {
      // Allow collision with player but not with other objects
      collisionFilter: {
        category: 0x0002,  // Rope category
        mask: 0x0001       // Only collide with player category
      },
      density: 0.001,
      friction: 0.5,
      frictionAir: 0.05,
      label: 'ropeSegment' // This is the critical part - ensure the label is set
    }
  );
  
  // Explicitly set the label again to ensure it's properly set
  segment.label = 'ropeSegment';
  
  ropeSegments.push(segment);
}

  return {
    segments: ropeSegments,
    segmentLength: segmentLength
  };
}
  connectRopeBlocks() {
  if (pendingRopeBlocks.length === 0) return;

  // Group rope blocks by their x-position (within a small tolerance)
  const ropeGroups = {};

  pendingRopeBlocks.forEach(ropeBlock => {
    // Round x position to the nearest 10 pixels to group nearby ropes
    const xKey = Math.round(ropeBlock.anchorX / 10) * 10;

    if (!ropeGroups[xKey]) {
      ropeGroups[xKey] = [];
    }

    ropeGroups[xKey].push(ropeBlock);
  });

  // Process each group of vertically aligned ropes
  Object.values(ropeGroups).forEach(ropeGroup => {
    if (ropeGroup.length === 0) return;

    // Sort by y-position (top to bottom)
    ropeGroup.sort((a, b) => a.anchorY - b.anchorY);

    // For each group, create a single continuous rope
    const topRope = ropeGroup[0];

    // Keep only the top anchor and remove all other anchors from the world
    for (let i = 1; i < ropeGroup.length; i++) {
      // Mark these blocks as "hidden" so they don't get drawn
      ropeGroup[i].isHidden = true;

      // Remove their bodies from the world
      World.remove(world, ropeGroup[i].body);
    }

    // Calculate total rope length based on the distance between top and bottom anchors
    const bottomRope = ropeGroup[ropeGroup.length - 1];
    const totalLength = bottomRope.anchorY + config.world.blockSize - topRope.anchorY;

    // Calculate total number of segments
    const totalSegments = Math.max(5, Math.floor(totalLength / 20)); // Ensure at least 5 segments

    // Create rope segments
    let ropeSegments = [];
    let constraints = [];
    const segmentLength = totalLength / totalSegments;

    // Create all segments
    for (let i = 0; i < totalSegments; i++) {
      let segment = Bodies.circle(
          topRope.anchorX,
          topRope.anchorY + (i + 0.5) * segmentLength,
          topRope.segmentRadius,
          {
            // Allow collision with player but not with other objects
            collisionFilter: {
              category: 0x0002,  // Rope category
              mask: 0x0001       // Only collide with player category
            },
            density: 0.001,
            friction: 0.5,
            frictionAir: 0.05,
            label: 'ropeSegment'
          }
      );
      ropeSegments.push(segment);
    }

    // Create constraints between segments
    constraints.push(Constraint.create({
      bodyA: topRope.body,
      bodyB: ropeSegments[0],
      length: segmentLength,
      stiffness: 0.9
    }));

    for (let i = 1; i < totalSegments; i++) {
      constraints.push(Constraint.create({
        bodyA: ropeSegments[i-1],
        bodyB: ropeSegments[i],
        length: segmentLength,
        stiffness: 0.9
      }));
    }

    // Add all segments and constraints to the world
    World.add(world, [...ropeSegments, ...constraints]);

    // Assign segments and constraints to the top rope block
    topRope.ropeSegments = ropeSegments;
    topRope.constraints = constraints;
    topRope.lastRopeSegment = ropeSegments[ropeSegments.length - 1];
    topRope.isTopRope = true;

    // Share the rope segments with all blocks in the group
    // (even though their bodies are removed, we keep a reference for drawing)
    for (let i = 1; i < ropeGroup.length; i++) {
      ropeGroup[i].ropeSegments = ropeSegments;
      ropeGroup[i].constraints = constraints;
      ropeGroup[i].lastRopeSegment = ropeSegments[ropeSegments.length - 1];

      if (i === ropeGroup.length - 1) {
        ropeGroup[i].isBottomRope = true;
      }
    }
  });
    pendingRopeBlocks = [];
  }
}


const configBlockEvents = (block) => {
  block.on("collide", (data) => {
    const __player = data[1];
    const __block = data[0];
    if(__block.t === "+") {
      nextLevel = true;
    }
  })

  block.on("update", () => {

  })
}

// Add this at the end of the file
// Collection to store rope blocks temporarily during level creation
let pendingRopeBlocks = [];

// Function to register a rope block
function registerRopeBlock(ropeBlock) {
  pendingRopeBlocks.push(ropeBlock);
}
function connectRopeBlocks() {
  if (pendingRopeBlocks.length === 0) return;
  
  // Group rope blocks by their x-position (within a small tolerance)
  const ropeGroups = {};
  
  pendingRopeBlocks.forEach(ropeBlock => {
    // Round x position to the nearest 10 pixels to group nearby ropes
    const xKey = Math.round(ropeBlock.anchorX / 10) * 10;
    
    if (!ropeGroups[xKey]) {
      ropeGroups[xKey] = [];
    }
    
    ropeGroups[xKey].push(ropeBlock);
  });
  
  // Process each group of vertically aligned ropes
  Object.values(ropeGroups).forEach(ropeGroup => {
    if (ropeGroup.length === 0) return;
    
    // Sort by y-position (top to bottom)
    ropeGroup.sort((a, b) => a.anchorY - b.anchorY);
    
    // For each group, create a single continuous rope
    const topRope = ropeGroup[0];
    
    // Keep only the top anchor and remove all other anchors from the world
    for (let i = 1; i < ropeGroup.length; i++) {
      // Mark these blocks as "hidden" so they don't get drawn
      ropeGroup[i].isHidden = true;
      
      // Remove their bodies from the world
      World.remove(world, ropeGroup[i].body);
    }
    
    // Calculate total rope length based on the distance between top and bottom anchors
    const bottomRope = ropeGroup[ropeGroup.length - 1];
    const totalLength = bottomRope.anchorY + config.world.blockSize - topRope.anchorY;
    
    // Calculate total number of segments
    const totalSegments = Math.max(5, Math.floor(totalLength / 20)); // Ensure at least 5 segments
    
    // Create rope segments
    let ropeSegments = [];
    let constraints = [];
    const segmentLength = totalLength / totalSegments;
    
    // Create all segments
    for (let i = 0; i < totalSegments; i++) {
      let segment = Bodies.circle(
        topRope.anchorX,
        topRope.anchorY + (i + 0.5) * segmentLength,
        topRope.segmentRadius,
        { 
          collisionFilter: { group: -1 }, 
          density: 0.001,
          friction: 0.5,
          frictionAir: 0.05
        }
      );
      ropeSegments.push(segment);
    }
    
    // Create constraints between segments
    constraints.push(Constraint.create({
      bodyA: topRope.body,
      bodyB: ropeSegments[0],
      length: segmentLength,
      stiffness: 0.9
    }));
    
    for (let i = 1; i < totalSegments; i++) {
      constraints.push(Constraint.create({
        bodyA: ropeSegments[i-1],
        bodyB: ropeSegments[i],
        length: segmentLength,
        stiffness: 0.9
      }));
    }
    
    // Add all segments and constraints to the world
    World.add(world, [...ropeSegments, ...constraints]);
    
    // Assign segments and constraints to the top rope block
    topRope.ropeSegments = ropeSegments;
    topRope.constraints = constraints;
    topRope.lastRopeSegment = ropeSegments[ropeSegments.length - 1];
    topRope.isTopRope = true;
    
    // Share the rope segments with all blocks in the group
    // (even though their bodies are removed, we keep a reference for drawing)
    for (let i = 1; i < ropeGroup.length; i++) {
      ropeGroup[i].ropeSegments = ropeSegments;
      ropeGroup[i].constraints = constraints;
      ropeGroup[i].lastRopeSegment = ropeSegments[ropeSegments.length - 1];
      
      if (i === ropeGroup.length - 1) {
        ropeGroup[i].isBottomRope = true;
      }
    }
  });
  
  // Clear the pending rope blocks for the next level
  pendingRopeBlocks = [];
}

// Make these functions available globally
window.registerRopeBlock = registerRopeBlock;
window.connectRopeBlocks = connectRopeBlocks;