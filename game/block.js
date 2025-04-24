const shapes = {
    rect: [
        {x: 0, y: 0},
        {x: config.world.blockSize, y: 0},
        {x: config.world.blockSize, y: config.world.blockSize},
        {x: 0, y: config.world.blockSize}
    ],
    slopeTL: [
        {x: config.world.blockSize, y: 0},
        {x: config.world.blockSize, y: config.world.blockSize},
        {x: 0, y: config.world.blockSize}
    ],
    slopeTR: [
        {x: 0, y: 0},
        {x: config.world.blockSize, y: config.world.blockSize},
        {x: 0, y: config.world.blockSize}
    ],
    slopeBL: [
        {x: 0, y: 0},
        {x: config.world.blockSize, y: config.world.blockSize},
        {x: config.world.blockSize, y: 0}
    ],
    slopeBR: [
        {x: 0, y: 0},
        {x: config.world.blockSize, y: 0},
        {x: 0, y: config.world.blockSize}
    ],
    seesaw: [
        {x: -config.world.blockSize * 1.5, y: -config.world.blockSize * 0.15},
        {x: config.world.blockSize * 1.5, y: -config.world.blockSize * 0.15},
        {x: config.world.blockSize * 1.5, y: config.world.blockSize * 0.15},
        {x: -config.world.blockSize * 1.5, y: config.world.blockSize * 0.15}
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
            {x: 0, y: 0},
            {x: 800, y: 0},
            {x: 800, y: 50},
            {x: 0, y: 50}
        ]
    },
    "b": {
        points: [
            {x: 0, y: 0},
            {x: 50, y: 0},
            {x: 50, y: 400},
            {x: 0, y: 400}
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
        maxAngle: 0.8, // Maximum rotation in radians (about 17 degrees)
        angularDamping: 0.05, // How quickly the seesaw slows down
        pivotFriction: 0.01, // How easily the seesaw rotates
        isExtensible: true // Flag to indicate this block can be extended horizontally
    },
    "r": {
        points: shapes.rect,
        isRope: true,
        segmentsPerBlock: 5, // Number of segments per block height
        segmentRadius: 5 // Radius of each rope segment
    },
    "g": {
        points: shapes.rect,
        isBreakable: true,
        breakSpeed: config.player.speed * 1.2, // Speed required to break the glass
        particleCount: 15, // Number of glass shards when broken
        particleLifetime: 60 // Frames until particles fade out (60 frames = 1 second at 60fps)
    }
};


class Block extends Body {
    constructor(type, x, y) {
        if (!blockTypes[type]) throw new Error(`Block of type '${type}' does not exist (level ${level}). Define a new block type or remove it from the level bitmap.`);
        let stats = blockTypes[type];

        let newBody;
        let ropeSegments = [];
        let isRope = type === 'r';
        let isPivoting = stats.isPivoting || false;
        let isExtensible = stats.isExtensible || false;
        let isBreakable = stats.isBreakable || false;
        // Store these variables temporarily
        let tempSegmentsPerBlock, tempSegmentRadius, tempAnchorX, tempAnchorY;

        if (isRope) {
            // Create an anchor point
            newBody = Bodies.circle(x, y, stats.segmentRadius * 2, {
                isStatic: true,
                collisionFilter: {group: -1} // Prevent collision with other objects
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
            newBody = Bodies.fromVertices(x, y, stats.points, {isStatic: true});
            const {min} = newBody.bounds;
            Matter.Body.setPosition(newBody, {
                x: x + (newBody.position.x - min.x),
                y: y + (newBody.position.y - min.y)
            });
        }

        super(newBody, "block");

        this.t = type;
        this.isRope = isRope;
        this.isPivoting = isPivoting;
        this.isExtensible = isExtensible;
        this.isBreakable = isBreakable;
        this.breakSpeed = stats.breakSpeed || 0;
        this.particleCount = stats.particleCount || 15;
        this.particleLifetime = stats.particleLifetime || 60;
        this.ropeSegments = ropeSegments;
        this.supports = [];
        this.angleCollision = null;
        this.isMoving = stats.isMoving || false;
        this.moveDistance = stats.moveDistance || 0;
        this.moveSpeed = stats.moveSpeed || 0;
        this.initialY = y;
        this.movingUp = true;
        this.broken = false;
        this.glassParticles = [];

        if (isPivoting) {
            // Set default properties for seesaw
            this.maxAngle = stats.maxAngle;

            // Register this seesaw block with the level manager
            if (typeof registerSeesawBlock === 'function') {
                registerSeesawBlock(this);
            }

            // Improve seesaw physics properties
            this.body.frictionAir = 0.05;
            this.body.restitution = 0.2;
            this.body.friction = 0.8;
            this.body.density = 0.002;
            this.body.angularDamping = 0.2;
        }

// Add this to the Block class constructor or initialization method
        if (this.isPivoting) {
            // Improve seesaw physics properties
            this.body.frictionAir = 0.05;  // Add air friction to dampen oscillation
            this.body.restitution = 0.2;   // Lower restitution to reduce bouncing

            // Set a higher friction for the seesaw surface
            this.body.friction = 0.8;

            // Increase density for more realistic mass distribution
            this.body.density = 0.002;

            // Add angular damping to make the seesaw movement more rigid
            this.body.angularDamping = 0.2;

            // Store the original constraint stiffness for reference
            if (this.constraint) {
                // this.originalStiffness = this.constraint.stiffness;

                // Make the pivot constraint stiffer for more rigid rotation
                this.constraint.stiffness = 0.9;

                // Add damping to the constraint to reduce oscillation
                this.constraint.damping = 0.2;
            }
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
        }

        configBlockEvents(this);
    }

    breakGlass() {
        // Mark the block as broken
        this.broken = true;

        // Remove the body from the world to prevent further collisions
        World.remove(world, this.body);

        // Play a glass breaking sound if available
        if (typeof playSound === 'function') {
            playSound('glass_break.mp3');
        }

        // Create glass particles
        const blockWidth = config.world.blockSize;
        const blockHeight = config.world.blockSize;
        const centerX = this.body.position.x;
        const centerY = this.body.position.y;

        // Get player's velocity for directional bias in particle movement
        const playerVelX = player.body.velocity.x;
        const playerVelY = player.body.velocity.y;

        // Create glass particles
        for (let i = 0; i < this.particleCount; i++) {
            // Create random vertices for the glass shard
            const size = random(5, 15);
            const irregularity = 0.5; // How irregular the shard shape

            // Create random vertices for an irregular glass shard
            const vertices = [];
            const vertexCount = random(3, 6); // Random number of vertices between 3 and 5

            for (let j = 0; j < vertexCount; j++) {
                const angle = map(j, 0, vertexCount, 0, TWO_PI);
                const radius = size * (1 - irregularity + random(irregularity * 2));
                vertices.push({
                    x: cos(angle) * radius,
                    y: sin(angle) * radius
                });
            }

            // Calculate random position within the block
            const offsetX = random(-blockWidth / 2, blockWidth / 2);
            const offsetY = random(-blockHeight / 2, blockHeight / 2);

            // Calculate velocity based on player's impact direction and random factors
            // This creates a more natural explosion effect
            const directionBias = 0.7; // How much the particles follow player's direction
            const randomness = 1.0 - directionBias;

            // Normalize player velocity to get direction
            const playerSpeed = Math.sqrt(playerVelX * playerVelX + playerVelY * playerVelY);
            const normalizedVelX = playerSpeed > 0 ? playerVelX / playerSpeed : 0;
            const normalizedVelY = playerSpeed > 0 ? playerVelY / playerSpeed : 0;

            // Calculate particle velocity with directional bias and randomness
            const particleSpeed = random(2, 8);
            const vx = (normalizedVelX * directionBias + random(-1, 1) * randomness) * particleSpeed;
            const vy = (normalizedVelY * directionBias + random(-1, 1) * randomness) * particleSpeed - random(1, 3); // Add upward bias

            // Create the particle
            this.glassParticles.push({
                x: centerX + offsetX,
                y: centerY + offsetY,
                vx: vx,
                vy: vy,
                angle: random(TWO_PI), // Random initial rotation
                vr: random(-0.2, 0.2), // Random rotation speed
                vertices: vertices,
                lifetime: this.particleLifetime + random(-10, 10) // Slightly randomize lifetime
            });
        }
    }


    draw() {
        if (this.isHidden || this.broken) {
            // Draw glass particles if the block is broken
            if (this.broken && this.glassParticles.length > 0) {
                for (let i = this.glassParticles.length - 1; i >= 0; i--) {
                    const particle = this.glassParticles[i];

                    // Calculate alpha based on remaining lifetime
                    const alpha = map(particle.lifetime, 0, this.particleLifetime, 0, 255);

                    // Draw the particle
                    fill(200, 230, 255, alpha);
                    stroke(255, 255, 255, alpha);
                    strokeWeight(1);

                    push();
                    translate(particle.x, particle.y);
                    rotate(particle.angle);

                    // Draw a glass shard (irregular quadrilateral)
                    beginShape();
                    for (let j = 0; j < particle.vertices.length; j++) {
                        vertex(particle.vertices[j].x, particle.vertices[j].y);
                    }
                    endShape(CLOSE);
                    pop();

                    // Update particle position
                    particle.x += particle.vx;
                    particle.y += particle.vy;

                    // Apply gravity
                    particle.vy += 0.1;

                    // Slow down rotation
                    particle.angle += particle.vr * 0.98;
                    particle.vr *= 0.98;

                    // Decrease lifetime
                    particle.lifetime--;

                    // Remove dead particles
                    if (particle.lifetime <= 0) {
                        this.glassParticles.splice(i, 1);
                    }
                }
            }
            return;
        }

        switch (this.t) {
            case "0":
            case "<":
            case ">":
            case "\\":
            case "/":
                fill(50);
                beginShape();
                for (var k = 0; k < this.body.vertices.length; k++) {
                    vertex(this.body.vertices[k].x, this.body.vertices[k].y);
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
                for (var j = 0; j < this.body.vertices.length; j++) {
                    vertex(this.body.vertices[j].x, this.body.vertices[j].y);
                }
                endShape();
                noStroke();
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
                    this.body.position.x - baseWidth / 2, this.body.position.y + baseHeight - 5,
                    this.body.position.x + baseWidth / 2, this.body.position.y + baseHeight - 5
                );

                // Draw the platform
                push();
                translate(this.body.position.x, this.body.position.y);
                rotate(this.body.angle);

                // Determine the width to use (extended or default)
                let platformWidth = this.isExtendedSeesaw ? this.seesawWidth : config.world.blockSize * 3;
                let halfWidth = platformWidth / 2;

                // Draw wooden planks for the platform - centered properly
                rectMode(CENTER); // This ensures the rectangle is drawn centered at (0,0)
                fill(150, 75, 0);
                rect(0, 0, platformWidth, config.world.blockSize * 0.3);

                // Add wood grain details
                stroke(120, 60, 0);
                strokeWeight(1);
                let grainSpacing = platformWidth / 15;
                for (let i = -halfWidth + grainSpacing; i <= halfWidth - grainSpacing; i += grainSpacing) {
                    line(
                        i, -config.world.blockSize * 0.15,
                        i, config.world.blockSize * 0.15
                    );
                }

                // Add end caps to make it look more finished
                fill(130, 65, 0);
                noStroke();
                rectMode(CORNER); // Switch back to corner mode for the end caps
                rect(-halfWidth, -config.world.blockSize * 0.15,
                    config.world.blockSize * 0.1, config.world.blockSize * 0.3);
                rect(halfWidth - config.world.blockSize * 0.1, -config.world.blockSize * 0.15,
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
            case "g":
                // Draw glass block with translucent effect
                fill(200, 230, 255, 180);  // Light blue with transparency
                stroke(255, 255, 255, 200);
                strokeWeight(2);

                beginShape();
                for (var i = 0; i < this.body.vertices.length; i++) {
                    vertex(this.body.vertices[i].x, this.body.vertices[i].y);
                }
                endShape(CLOSE);

                // Add glass reflections
                noFill();
                stroke(255, 255, 255, 100);
                strokeWeight(1);

                // Draw diagonal reflection lines
                line(
                    this.body.vertices[0].x, this.body.vertices[0].y,
                    this.body.vertices[2].x, this.body.vertices[2].y
                );

                line(
                    this.body.vertices[1].x, this.body.vertices[1].y,
                    this.body.vertices[3].x, this.body.vertices[3].y
                );

                noStroke();
                break;
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

            // Check if this is a breakable glass block
            if (this.isBreakable && !this.broken) {
                const horizontalSpeed = Math.abs(player.body.velocity.x);
                const verticalSpeed = Math.abs(player.body.velocity.y);
                const playerSpeed = Math.max(horizontalSpeed, verticalSpeed);

                // Check if player is moving fast enough to break the glass
                // Break glass if player hits it from the side with sufficient speed
                if (playerSpeed  > this.breakSpeed) {
                    this.breakGlass();
                }
            }

            // If this is a pivoting platform, handle seesaw physics
            if (this.isPivoting) {
                this.playerOnSeesaw = true;

                // Calculate player's position relative to the pivot point
                let relativeX = player.body.position.x - this.body.position.x;

                // Calculate the seesaw's current angle
                const seesawAngle = this.body.angle;

                // Apply torque to the seesaw - more responsive than setting angular velocity
                Matter.Body.applyForce(
                    this.body,
                    {x: this.body.position.x + relativeX, y: this.body.position.y},
                    {x: 0, y: relativeX > 0 ? 0.0005 : -0.0005}
                );

                // Calculate the surface normal based on the seesaw angle
                let surfaceNormal = {
                    x: -Math.sin(seesawAngle),
                    y: Math.cos(seesawAngle)
                };

                // Apply a force to keep the player attached to the seesaw surface
                // This is crucial for preventing falling through on downward slopes
                const attachmentForce = 0.001;
                Matter.Body.applyForce(
                    player.body,
                    player.body.position,
                    {
                        x: surfaceNormal.x * attachmentForce,
                        y: surfaceNormal.y * attachmentForce
                    }
                );
            }
        } else {
            this.supports = [];
            this.angleCollision = null;

            // If player was on seesaw but is no longer, apply inertia and damping
            if (this.isPivoting && this.playerOnSeesaw) {
                this.playerOnSeesaw = false;

                // Apply a stronger restoring force to gradually return to equilibrium
                // This simulates the seesaw settling after the player jumps off
                let currentAngle = this.body.angle;
                let restoringTorque = -currentAngle * 0.03; // Increased from 0.01

                Matter.Body.setAngularVelocity(
                    this.body,
                    this.body.angularVelocity * 0.9 + restoringTorque // Added damping factor
                );
            }
        }

        // Additional check for breaking glass when player collides from the side
        // This handles cases where the player runs into the glass with momentum
        if (this.isBreakable && !this.broken) {
            // Check for any collision, not just supporting collisions
            const anyCollision = Matter.Detector.collisions(
                Matter.Detector.create({
                    bodies: [this.body, player.body]
                })
            ).length > 0;

            // if (anyCollision) {
            //     // Calculate player's horizontal speed
            //     const horizontalSpeed = Math.abs(player.body.velocity.x);
            //
            //     // Break glass if player is moving fast horizontally
            //     if (horizontalSpeed > this.breakSpeed * 0.8) {
            //         this.breakGlass();
            //     }
            // }
        }
    }

    update() {
        if (this.isMoving) {
            let currentY = this.body.position.y;
            if (this.movingUp) {
                if (currentY > this.initialY - this.moveDistance) {
                    bd.setPosition(this.body, {x: this.body.position.x, y: currentY - this.moveSpeed});
                } else {
                    this.movingUp = false;
                }
            } else {
                if (currentY < this.initialY) {
                    bd.setPosition(this.body, {x: this.body.position.x, y: currentY + this.moveSpeed});
                } else {
                    this.movingUp = true;
                }
            }
        }

// For pivoting platforms, limit the rotation angle and improve physics
        if (this.isPivoting) {
            // Apply angular damping to make movement more rigid
            Matter.Body.setAngularVelocity(
                this.body,
                this.body.angularVelocity * 0.98
            );

            if (this.maxAngle) {
                let currentAngle = this.body.angle % (Math.PI * 2);
                if (currentAngle > Math.PI) currentAngle -= Math.PI * 2;
                if (currentAngle < -Math.PI) currentAngle += Math.PI * 2;

                if (Math.abs(currentAngle) > this.maxAngle) {
                    // If exceeding max angle, set to max and reduce angular velocity more aggressively
                    let newAngle = currentAngle > 0 ? this.maxAngle : -this.maxAngle;
                    Matter.Body.setAngle(this.body, newAngle);
                    Matter.Body.setAngularVelocity(this.body, this.body.angularVelocity * 0.3); // More damping
                }
            }

            // Only apply equilibrium force if this is not part of an extended seesaw
            // This prevents conflicts when multiple blocks share the same body
            if (!this.isPartOfExtendedSeesaw) {
                // Apply a small restoring force toward equilibrium
                // This makes the seesaw naturally want to return to level
                const equilibriumForce = -this.body.angle * 0.0005;
                Matter.Body.applyForce(
                    this.body,
                    this.body.position,
                    {x: 0, y: equilibriumForce}
                );
            }
        }
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
            const bottomRope = ropeGroup[ropeGroup.length - 1];

            // Keep only the top anchor and remove all other anchors from the world
            for (let i = 1; i < ropeGroup.length; i++) {
                // Mark these blocks as "hidden" so they don't get drawn
                ropeGroup[i].isHidden = true;

                // Remove their bodies from the world
                World.remove(world, ropeGroup[i].body);
            }

            // Calculate total rope length based on the distance between top and bottom anchors
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

                // Explicitly set the label to ensure it's properly set
                segment.label = 'ropeSegment';

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
                    bodyA: ropeSegments[i - 1],
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
}


const configBlockEvents = (block) => {
    block.on("collide", (data) => {
        const __block = data[0];
        if (__block.t === "+") {
            nextLevel = true;
        }
    })

    block.on("update", () => {

    })
}

// Add this at the end of the file, replacing the duplicate connectRopeBlocks function
// Collection to store seesaw blocks temporarily during level creation
let pendingRopeBlocks = [];
let pendingSeesawBlocks = [];

// Function to register a seesaw block
function registerSeesawBlock(seesawBlock) {
    pendingSeesawBlocks.push(seesawBlock);

    // Create a constraint for the pivot point if this is a standalone seesaw
    if (!seesawBlock.constraint) {
        const pivotConstraint = Matter.Constraint.create({
            pointA: {
                x: seesawBlock.body.position.x,
                y: seesawBlock.body.position.y
            },
            bodyB: seesawBlock.body,
            pointB: {x: 0, y: 0},
            stiffness: 0.9,
            length: 0
        });

        World.add(world, pivotConstraint);
        seesawBlock.constraint = pivotConstraint;
    }
}

function connectSeesawBlocks() {
    if (pendingSeesawBlocks.length === 0) return;

    // Group seesaw blocks by their y-position (within a small tolerance)
    const seesawGroups = {};

    pendingSeesawBlocks.forEach(seesawBlock => {
        // Round y position to the nearest 10 pixels to group nearby seesaws
        const yKey = Math.round(seesawBlock.body.position.y / 10) * 10;

        if (!seesawGroups[yKey]) {
            seesawGroups[yKey] = [];
        }

        seesawGroups[yKey].push(seesawBlock);
    });

    // Process each group of horizontally aligned seesaws
    Object.values(seesawGroups).forEach(seesawGroup => {
        if (seesawGroup.length <= 1) return; // Need at least 2 blocks to extend

        // Sort by x-position (left to right)
        seesawGroup.sort((a, b) => a.body.position.x - b.body.position.x);

        // Calculate the total width of the seesaw
        const totalWidth = (seesawGroup.length * config.world.blockSize);
        const halfWidth = totalWidth / 2;

        // Use the middle block as the pivot point
        const middleIndex = Math.floor(seesawGroup.length / 2);
        const pivotBlock = seesawGroup[middleIndex];
        const pivotX = pivotBlock.body.position.x;
        const pivotY = pivotBlock.body.position.y;

        // Remove any existing constraints from the world
        seesawGroup.forEach(block => {
            if (block.constraint) {
                World.remove(world, block.constraint);
                block.constraint = null;
            }
        });

        // Create a new, wider seesaw body
        const seesawPoints = [
            {x: -halfWidth, y: -config.world.blockSize * 0.15},
            {x: halfWidth, y: -config.world.blockSize * 0.15},
            {x: halfWidth, y: config.world.blockSize * 0.15},
            {x: -halfWidth, y: config.world.blockSize * 0.15}
        ];

        const newSeesawBody = Bodies.fromVertices(pivotX, pivotY, [seesawPoints], {
            isStatic: false,
            friction: 0.5,
            frictionAir: 0.05,
            density: 0.002,
            restitution: 0.2,
        });

        // Remove all the original seesaw bodies
        seesawGroup.forEach(block => {
            World.remove(world, block.body);
            block.isHidden = true;
        });

        // Add the new body to the world
        World.add(world, newSeesawBody);

        // Create a new constraint for the pivot
        const newConstraint = Matter.Constraint.create({
            pointA: {x: pivotX, y: pivotY},
            bodyB: newSeesawBody,
            pointB: {x: 0, y: 0},
            stiffness: 0.9,
            length: 0
        });

        World.add(world, newConstraint);

        // Update the pivot block with the new body and constraint
        pivotBlock.body = newSeesawBody;
        pivotBlock.constraint = newConstraint;
        pivotBlock.isHidden = false;
        pivotBlock.isExtendedSeesaw = true;
        pivotBlock.seesawWidth = totalWidth;

        // Set angular damping
        newSeesawBody.angularDamping = 0.2;

        // Share the new body with all blocks in the group
        for (let i = 0; i < seesawGroup.length; i++) {
            if (i !== middleIndex) {
                seesawGroup[i].body = newSeesawBody;
                seesawGroup[i].constraint = newConstraint;
                seesawGroup[i].isPartOfExtendedSeesaw = true;
            }
        }
    });

    // Clear the pending seesaw blocks for the next level
    pendingSeesawBlocks = [];
}


// Function to register a rope block
function registerRopeBlock(ropeBlock) {
    pendingRopeBlocks.push(ropeBlock);
}

// Make these functions available globally
window.registerRopeBlock = registerRopeBlock;
window.registerSeesawBlock = registerSeesawBlock;
window.connectRopeBlocks = Block.prototype.connectRopeBlocks;
window.connectSeesawBlocks = connectSeesawBlocks;
