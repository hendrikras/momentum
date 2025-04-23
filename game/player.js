class Player extends Body {
  constructor(body) {
    super(body, "player");

    // Add rope grabbing properties
    this.isGrabbingRope = false;
    this.grabbedRopeSegment = null;
    this.ropeConstraint = null;

    this.speed = 0;
    this.supports = [];
    this.sensors = {};
    this.dashTimer = config.player.dashTime;
    this.canDash = false;
    this.angleCollisions = [];
    this.died = false;
  }

  // Draw the player on the canvas
  draw() {
    let pos = this.body.position;
    let w = config.player.width;
    let h = config.player.height * 0.65;

    // Animation parameters
    let runCycle = (frameCount % 40) / 40; // 0 to 1 over 20 frames
    let isRunning = Math.abs(this.speed) > 0.1;
    let isJumping = !this.sensors.bottom;
    let direction = this.speed > 0 ? 1 : -1;

    push(); // Save the current drawing state
    translate(pos.x, pos.y);
    scale(-direction, 1); // Flip horizontally based on direction
    let scaleFactor = w / 512;

    // Calculate head position - make it smaller to fit within body bounds
    let headHeight = h * 0.4; // Head takes up 40% of total height
    let headOffset = -h/2 + headHeight/2; // Position head at top of character

    // Draw the body first - ensure it stays within physics bounds
    stroke("#050b55");
    strokeWeight(w/8); // Thinner lines
    noFill();

    // Torso - shorter to accommodate head
    let torsoTop = -h/2 + headHeight;
    let torsoBottom = h/4; // Shorter torso
    line(0, torsoTop, 0, torsoBottom);

    // Arms - improved natural movement
    let shoulderY = torsoTop + (torsoBottom - torsoTop) * 0.2; // Shoulders at 20% down the torso
    let armLength = w * 0.3; // Shorter arms to stay within bounds

    // More natural arm movement during running
    let leftArmAngle, rightArmAngle;

    if (isRunning) {
      // Opposite arm-leg movement (when left leg forward, right arm forward)
      leftArmAngle = sin(runCycle * TWO_PI + PI) * PI/4; // Offset by PI to be opposite of legs
      rightArmAngle = sin(runCycle * TWO_PI) * PI/4;
    } else if (isJumping) {
      // Arms up when jumping
      leftArmAngle = -PI/4;
      rightArmAngle = -PI/4;
    } else {
      // Slight angle when idle
      leftArmAngle = PI/8;
      rightArmAngle = PI/8;
    }

    // Left arm with improved elbow bend
    push();
    translate(0, shoulderY);
    rotate(leftArmAngle);
    line(0, 0, armLength, 0); // Upper arm

    // Elbow bends more naturally
    let leftElbowBend;
    if (isRunning) {
      // Elbow bends more during running, synchronized with arm swing
      leftElbowBend = map(sin(runCycle * TWO_PI + PI/2), -1, 1, PI/8, PI/3);
    } else if (isJumping) {
      // Bent elbows when jumping
      leftElbowBend = PI/4;
    } else {
      // Slight bend when idle
      leftElbowBend = PI/6;
    }

    translate(armLength, 0);
    rotate(leftElbowBend);
    line(0, 0, armLength * 0.8, 0); // Lower arm (slightly shorter)
    pop();

    // Right arm with improved elbow bend
    push();
    translate(0, shoulderY);
    rotate(-rightArmAngle); // Negative to mirror the left arm
    line(0, 0, armLength, 0); // Upper arm

    // Elbow bends more naturally
    let rightElbowBend;
    if (isRunning) {
      // Elbow bends more during running, synchronized with arm swing
      rightElbowBend = map(sin(runCycle * TWO_PI - PI/2), -1, 1, PI/8, PI/3);
    } else if (isJumping) {
      // Bent elbows when jumping
      rightElbowBend = PI/4;
    } else {
      // Slight bend when idle
      rightElbowBend = PI/6;
    }

    translate(armLength, 0);
    rotate(rightElbowBend);
    line(0, 0, armLength * 0.8, 0); // Lower arm (slightly shorter)
    pop();

    // Legs - improved natural movement
    let hipY = torsoBottom;
    let legLength = h * 0.25; // Shorter legs

    // More natural leg movement during running
    let leftLegAngle, rightLegAngle;

    if (isRunning) {
      // Running cycle for legs
      leftLegAngle = sin(runCycle * TWO_PI) * PI/4;
      rightLegAngle = sin(runCycle * TWO_PI + PI) * PI/4; // Offset by PI to alternate with left leg
    } else if (isJumping) {
      // Legs tucked up slightly when jumping
      leftLegAngle = -PI/6;
      rightLegAngle = -PI/6;
    } else {
      // Standing straight when idle
      leftLegAngle = 0;
      rightLegAngle = 0;
    }

    // Flip leg angles based on direction
    if (direction < 0) {
      [leftLegAngle, rightLegAngle] = [rightLegAngle, leftLegAngle];
    }

    // Left leg with improved knee bend
    push();
    translate(0, hipY);
    rotate(leftLegAngle);
    line(0, 0, 0, legLength); // Upper leg

    // Knee bends more naturally
    let leftKneeBend;
    if (isRunning) {
      // Knee bends more during running, synchronized with leg swing
      leftKneeBend = map(sin(runCycle * TWO_PI - PI/4), -1, 1, 0, PI/3);
    } else if (isJumping) {
      // Bent knees when jumping
      leftKneeBend = PI/4;
    } else {
      // Slight bend when idle
      leftKneeBend = PI/20;
    }

    translate(0, legLength);
    rotate(leftKneeBend);
    line(0, 0, 0, legLength); // Lower leg

    // Draw left boot
    push();
    translate(0, legLength);
    fill(40, 40, 40); // Dark gray for boots
    noStroke();
    // Boot shape
    beginShape();
    vertex(-w/12, 0);
    vertex(w/20, 0);
    vertex(w/15, w/20);
    vertex(-w/10, w/20);
    endShape(CLOSE);
    // Boot sole
    fill(30, 30, 30); // Darker for sole
    rect(-w/10, w/20, w/6, w/30);
    pop();

    pop();

    // Right leg with improved knee bend
    push();
    translate(0, hipY);
    rotate(rightLegAngle);
    line(0, 0, 0, legLength); // Upper leg

    // Knee bends more naturally
    let rightKneeBend;
    if (isRunning) {
      // Knee bends more during running, synchronized with leg swing
      rightKneeBend = map(sin(runCycle * TWO_PI + 3*PI/4), -1, 1, 0, PI/3);
    } else if (isJumping) {
      // Bent knees when jumping
      rightKneeBend = PI/4;
    } else {
      // Slight bend when idle
      rightKneeBend = PI/20;
    }

    translate(0, legLength);
    rotate(rightKneeBend);
    line(0, 0, 0, legLength); // Lower leg

    // Draw right boot
    push();
    translate(0, legLength);
    fill(40, 40, 40); // Dark gray for boots
    noStroke();
    // Boot shape
    beginShape();
    vertex(-w/12, 0);
    vertex(w/20, 0);
    vertex(w/15, w/20);
    vertex(-w/10, w/20);
    endShape(CLOSE);
    // Boot sole
    fill(30, 30, 30); // Darker for sole
    rect(-w/10, w/20, w/6, w/30);
    pop();

    pop();

    // Now draw the head on top of the body
    push();
    translate(0, headOffset); // Move head to top of character

    // Scale the head to fit within the physics body
    let headScale = headHeight / (scaleFactor * 512);
    scale(headScale, headScale);

    fill("#050b55");
    noStroke();

    // Draw the head (blue part)
    beginShape();
    vertex(scaleFactor * (372.016 - 256), scaleFactor * (104.096 - 256));
    bezierVertex(
        scaleFactor * (326.224 - 256), scaleFactor * (73.48 - 256),
        0, scaleFactor * (73.48 - 256),
        scaleFactor * (139.984 - 256), scaleFactor * (104.096 - 256)
    );
    vertex(scaleFactor * (63.656 - 256), scaleFactor * (0 - 256));
    vertex(scaleFactor * (63.656 - 256), scaleFactor * (512 - 256));
    vertex(0, scaleFactor * (512 - 256));
    vertex(scaleFactor * (448.344 - 256), scaleFactor * (512 - 256));
    vertex(scaleFactor * (448.344 - 256), scaleFactor * (0 - 256));
    vertex(scaleFactor * (372.016 - 256), scaleFactor * (104.096 - 256));
    endShape(CLOSE);

    // Draw the eyes (red parts)
    fill("#ff3d2e");
    beginShape();
    vertex(scaleFactor * (111.464 - 256), scaleFactor * (211.248 - 256));
    vertex(scaleFactor * (236.64 - 256), scaleFactor * (252.576 - 256));
    bezierVertex(
        scaleFactor * (236.64 - 256), scaleFactor * (252.576 - 256),
        scaleFactor * (207.64 - 256), scaleFactor * (301.56 - 256),
        scaleFactor * (164.896 - 256), scaleFactor * (292.376 - 256)
    );
    bezierVertex(
        scaleFactor * (122.152 - 256), scaleFactor * (283.2 - 256),
        scaleFactor * (111.464 - 256), scaleFactor * (211.248 - 256),
        scaleFactor * (111.464 - 256), scaleFactor * (211.248 - 256)
    );
    endShape(CLOSE);

    fill("#ff3d2e");
    beginShape();
    vertex(scaleFactor * (400.536 - 256), scaleFactor * (211.248 - 256));
    vertex(scaleFactor * (275.36 - 256), scaleFactor * (252.584 - 256));
    bezierVertex(
        scaleFactor * (275.36 - 256), scaleFactor * (252.584 - 256),
        scaleFactor * (304.36 - 256), scaleFactor * (301.568 - 256),
        scaleFactor * (347.104 - 256), scaleFactor * (292.384 - 256)
    );
    bezierVertex(
        scaleFactor * (389.848 - 256), scaleFactor * (283.2 - 256),
        scaleFactor * (400.536 - 256), scaleFactor * (211.248 - 256),
        scaleFactor * (400.536 - 256), scaleFactor * (211.248 - 256)
    );
    endShape(CLOSE);

    // Draw the highlight (white part)
    fill(255, 255, 255, 38); // 15% opacity white
    beginShape();
    vertex(0, scaleFactor * (73.48 - 256));
    bezierVertex(
        scaleFactor * (185.776 - 256), scaleFactor * (73.48 - 256),
        scaleFactor * (139.984 - 256), scaleFactor * (104.096 - 256),
        scaleFactor * (139.984 - 256), scaleFactor * (104.096 - 256)
    );
    vertex(scaleFactor * (63.656 - 256), scaleFactor * (0 - 256));
    vertex(scaleFactor * (63.656 - 256), scaleFactor * (512 - 256));
    vertex(0, scaleFactor * (512 - 256));
    endShape(CLOSE);

    // Draw the mouth (yellow part)
    fill("#ffcc67");
    beginShape();
    vertex(scaleFactor * (139.224 - 256), scaleFactor * (356.384 - 256));
    vertex(scaleFactor * (372.824 - 256), scaleFactor * (356.384 - 256));
    vertex(scaleFactor * (372.824 - 256), scaleFactor * (452.784 - 256));
    vertex(scaleFactor * (139.224 - 256), scaleFactor * (452.784 - 256));
    vertex(scaleFactor * (139.224 - 256), scaleFactor * (356.384 - 256));
    endShape(CLOSE);

    beginShape();
    vertex(scaleFactor * (189.088 - 256), scaleFactor * (420.68 - 256));
    vertex(scaleFactor * (326.48 - 256), scaleFactor * (420.68 - 256));
    bezierVertex(
        scaleFactor * (326.48 - 256), scaleFactor * (420.68 - 256),
        scaleFactor * (265.416 - 256), scaleFactor * (353.32 - 256),
        scaleFactor * (189.088 - 256), scaleFactor * (420.68 - 256)
    );
    endShape(CLOSE);

    // Draw the mouth highlight
    fill(255, 255, 255, 38); // 15% opacity white
    beginShape();
    vertex(scaleFactor * (139.224 - 256), scaleFactor * (356.384 - 256));
    vertex(scaleFactor * (139.224 - 256), scaleFactor * (398.048 - 256));
    bezierVertex(
        scaleFactor * (139.224 - 256), scaleFactor * (398.048 - 256),
        scaleFactor * (249.264 - 256), scaleFactor * (349.936 - 256),
        scaleFactor * (372.784 - 256), scaleFactor * (398.048 - 256)
    );
    vertex(scaleFactor * (372.784 - 256), scaleFactor * (356.384 - 256));
    vertex(scaleFactor * (139.224 - 256), scaleFactor * (356.384 - 256));
    endShape(CLOSE);

    pop(); // End head transformation

    // Debug: Draw physics body outline
    if (false) { // Set to true to see physics bounds
      noFill();
      stroke(255, 0, 0);
      strokeWeight(1);
      rectMode(CENTER);
      rect(0, 0, w, h);
    }

    pop(); // Restore the original drawing state
  }

  // Run the player and functionalize commands
  run() {
    this.emit("update");
    // Blocks the player is touching
    const supports = bodies.filter(x => x.type === "block").map(x => {
      return x.supports.length > 0 ? x.supports : false
    }).filter(x => x).flat(2);

    // What angles touching blocks are touching the player at (tangents)
    let angleCollisions = [...new Set(bodies.filter(x => x.type === "block").map(x => x.angleCollision).filter(x => x !== null).map(x => Number(x) + 90))];
    if(JSON.stringify(this.angleCollisions) !== JSON.stringify(angleCollisions)){
      this.angleCollisions = angleCollisions;
      this.emit("collide", angleCollisions);
    }


    // Set the player's inertia to infinity so that it stays upright and doesn't rotate to external forces
    bd.setInertia(this.body, Infinity);

    // Sensors for touching blocks
    this.sensors = {
      // Whether the player is standing on something
      bottom: supports.some(s => Math.round(s.y) === Math.round(this.body.position.y + config.player.height / 2)),

      // Is the player touching a block on the left?
      left: supports.filter(s => Math.round(s.y) !== Math.round(this.body.position.y + config.player.height / 2)).some(s => Math.round(s.x) === Math.round(player.body.position.x - config.player.width / 2)),

      // Is the player touching a block on the right?
      right: supports.filter(s => Math.round(s.y) !== Math.round(this.body.position.y + config.player.height / 2)).some(s => Math.round(s.x) === Math.round(player.body.position.x + config.player.width / 2))
    }
    //this.angleCollisions.some(x => x === 180)
    //this.angleCollisions.some(x => x === 0)
    const standingOnSeesaw = bodies.some(body =>
        body.type === "block" &&
        body.isPivoting &&
        body.playerOnSeesaw &&
        this.sensors.bottom
    );

    if (standingOnSeesaw) {
      // Find the seesaw the player is standing on
      const seesaw = bodies.find(body =>
          body.type === "block" &&
          body.isPivoting &&
          body.playerOnSeesaw
      );

      if (seesaw) {
        // Calculate the player's position relative to the seesaw pivot
        const relativeX = this.body.position.x - seesaw.body.position.x;
        
        // Calculate the seesaw's surface angle
        const seesawAngle = seesaw.body.angle;
        
        // 1. Make the seesaw more rigid by increasing its inertia and mass
        // This prevents excessive bouncing and makes the pivot more stable
        if (!seesaw.physicsAdjusted) {
          // Only do this once per seesaw
          seesaw.body.inertia = seesaw.body.inertia * 2;
          seesaw.body.mass = seesaw.body.mass * 1.5;
          seesaw.physicsAdjusted = true;
        }
        
        // 2. Adjust player friction based on the seesaw angle
        // Higher friction on steeper angles to prevent sliding
        const tiltFactor = Math.abs(Math.sin(seesawAngle));
        this.body.friction = 0.2 + tiltFactor * 0.6; // 0.2 to 0.8 based on tilt
        
        // 3. For steep downward slopes, apply a small downward force
        // This helps prevent the player from falling through the platform
        if (seesawAngle * relativeX > 0 && Math.abs(seesawAngle) > 0.2) {
          // The player is on the downward side of the seesaw
          // Apply a small force to keep the player pressed against the platform
          Matter.Body.applyForce(this.body, this.body.position, {
            x: 0,
            y: 0.001 // Very small downward force
          });
        }
        
        // 4. For steep upward slopes, reduce bouncing by dampening vertical velocity
        if (seesawAngle * relativeX < 0 && Math.abs(seesawAngle) > 0.2) {
          // The player is on the upward side of the seesaw
          // If the player is moving upward (bouncing), dampen the velocity
          if (this.body.velocity.y < 0) {
            Matter.Body.setVelocity(this.body, {
              x: this.body.velocity.x,
              y: this.body.velocity.y * 0.8 // Reduce upward velocity
            });
          }
        }
        
        // 5. Make the seesaw respond more to player position
        // Apply torque based on player position to make the seesaw tilt more naturally
        const torqueFactor = 0.0002; // Adjust this value to control sensitivity
        Matter.Body.applyForce(seesaw.body, 
          {x: seesaw.body.position.x + relativeX, y: seesaw.body.position.y},
          {x: 0, y: relativeX > 0 ? torqueFactor : -torqueFactor}
        );
        
        // 6. Ensure the player's horizontal velocity matches the seesaw's rotation
        // This prevents the player from sliding off steep angles
        if (Math.abs(seesawAngle) > 0.3) { // Only for steep angles
          // Calculate the tangential velocity at the player's position
          const tangentialVelocity = seesaw.body.angularVelocity * relativeX;
          
          // Only apply if the seesaw is moving significantly
          if (Math.abs(seesaw.body.angularVelocity) > 0.01) {
            // Get current velocity
            const currentVel = this.body.velocity;
            
            // Apply a correction (50% seesaw motion, 50% player control)
            Matter.Body.setVelocity(this.body, {
              x: currentVel.x * 0.5 + tangentialVelocity * 0.5,
              y: currentVel.y
            });
          }
        }
      }
    }
// Handle rope swinging physics
if (this.isGrabbingRope && this.ropeAnchor) {
  // Calculate the vector from anchor to player
  const dx = this.body.position.x - this.ropeAnchor.position.x;
  const dy = this.body.position.y - this.ropeAnchor.position.y;
  const ropeAngle = Math.atan2(dy, dx);
  const perpAngle = ropeAngle + Math.PI/2;
  
  // Apply forces for swinging control
  if (keys["ArrowLeft"] || keys["a"]) {
    // Apply force perpendicular to the rope in the counter-clockwise direction
    Matter.Body.applyForce(this.body, this.body.position, {
      x: Math.cos(perpAngle) * 0.002,
      y: Math.sin(perpAngle) * 0.002
    });
  }
  
  if (keys["ArrowRight"] || keys["d"]) {
    // Apply force perpendicular to the rope in the clockwise direction
    Matter.Body.applyForce(this.body, this.body.position, {
      x: Math.cos(perpAngle + Math.PI) * 0.002,
      y: Math.sin(perpAngle + Math.PI) * 0.002
    });
  }
  
  // Climbing up and down the rope
  if (keys["ArrowUp"] || keys["w"]) {
    // Shorten the constraint length to climb up
    if (this.anchorConstraint && this.anchorConstraint.length > 50) {
      this.anchorConstraint.length -= 2;
    }
  }
  
  if (keys["ArrowDown"] || keys["s"]) {
    // Lengthen the constraint length to climb down
    this.anchorConstraint.length += 2;
  }
  
  // Release rope with E key
  if (keys["e"] || keys["E"]) {
    this.releaseRope();
    
    // Apply a jump impulse when releasing with jump
    // if (keys["ArrowUp"] || keys["w"] || keys[" "]) {
    //   // Calculate jump direction - jump away from the rope anchor
    //   const jumpMagnitude = config.player.jumpForce * 0.8;
    //   const jumpAngle = ropeAngle - Math.PI/4; // Jump up and away from anchor
    //
    //   Matter.Body.setVelocity(this.body, {
    //     x: Math.cos(jumpAngle) * jumpMagnitude,
    //     y: Math.sin(jumpAngle) * jumpMagnitude
    //   });
    // }
  }
  
  // Skip the rest of the normal movement code
  return;
}

    // Moving Right
    if (keys["ArrowRight"] || keys["d"]) {
      if(this.speed < config.player.speed) this.speed += config.player.acceleration;
      else this.speed += (config.player.speed - this.speed) / config.player.decceleration/5
      this.emit("move.left", this);
    }

    // Moving Left
    if (keys["ArrowLeft"] || keys["a"]) {
      if(this.speed > -config.player.speed) this.speed -= config.player.acceleration;
      else this.speed += (-config.player.speed - this.speed) / config.player.decceleration/5
      this.emit("move.right", this);
    }

    // If not moving right or left, slow down
    if(!keys["ArrowRight"] && !keys["ArrowLeft"] && !keys["a"] && !keys["d"]){
      this.speed += -this.speed/config.player.decceleration;
    }

    // Apply Velocity
    bd.setVelocity(this.body, {
      x: this.speed,
      y: constrain(this.body.velocity.y, -config.world.maxYVel, config.world.maxYVel)
    });

    // Jumping and Wall-jumping
    if (keys["ArrowUp"] || keys["w"] || keys[" "]) {
      // If not touching left and right walls, wall-jump
      if (this.sensors.bottom && !this.sensors.left && !this.sensors.right) {
        bd.translate(this.body, {
          x: 0,
          y: -5
        });
        bd.applyForce(this.body, {
          x: this.body.position.x,
          y: this.body.position.y + config.player.height / 2
        }, {
          x: 0,
          y: -config.player.jumpForce
        });
        this.sensors.bottom = false;
        this.emit("jump.up", this);
        this.i
      } else {
        if(config.player.actions.includes("wall jump")) {
          // Jump off a wall depending on which side the player is touching
          if (this.sensors.left) {
            this.speed = config.player.speed/2;
            bd.setVelocity(this.body, {
              x: config.player.jumpForce*2,
              y: -config.player.jumpForce
            })
            bd.translate(this.body, {
              x: 5,
              y: -5
            });
            bd.applyForce(this.body, {
              x: this.body.position.x,
              y: this.body.position.y
            }, {
              x: config.player.jumpForce * 2,
              y: -config.player.jumpForce
            });
            this.emit("jump.left", this);
            this.sensors.left = false;
          } else if (this.sensors.right) {
            this.speed = -config.player.speed/2;
            bd.setVelocity(this.body, {
              x: -config.player.jumpForce*2,
              y: -config.player.jumpForce
            })
            bd.translate(this.body, {
              x: -5,
              y: -5
            });
            bd.applyForce(this.body, {
              x: this.body.position.x,
              y: this.body.position.y
            }, {
              x: -config.player.jumpForce * 2,
              y: -config.player.jumpForce
            });
            this.emit("jump.right", this);
            this.sensors.right = false;
          }
        }
      }
    }

    // Dash
    if(config.player.actions.includes("dash")){
      if(!this.canDash) this.canDash = this.sensors.bottom;
      if(this.dashTimer > 0) this.dashTimer--;
      if(keys["Shift"] && this.dashTimer <= 0 && this.canDash) {
        if((keys["ArrowRight"] || keys["d"]) && (!keys["ArrowLeft"] && !keys["a"])){
          this.speed = config.player.speed * 4;
          bd.setVelocity(this.body, {
            x: this.speed,
            y: -config.player.speed * 0.5
          });
        } else if((keys["ArrowLeft"] || keys["a"]) && (!keys["ArrowRight"] && !keys["d"])) {
          this.speed = config.player.speed * -4;
          bd.setVelocity(this.body, {
            x: this.speed,
            y: -config.player.speed * 0.5
          });
        }
        this.emit("dash", this);
        this.canDash = false;
        this.dashTimer = config.player.dashTime;
      }
    }

    // Dying
    if(this.body.position.y > (levels[level].bitmap.length * config.world.blockSize) + 500) {
      this.died = true;
    }
  }

grabRope(ropeSegment) {
  if (this.isGrabbingRope) return; // Already grabbing a rope
  
  console.log("Grabbing rope segment:", ropeSegment.label);
  
  // Store the original collision filters
  this.originalPlayerCategory = this.body.collisionFilter.category;
  this.originalPlayerMask = this.body.collisionFilter.mask;
  this.originalRopeCategory = ropeSegment.collisionFilter.category;
  this.originalRopeMask = ropeSegment.collisionFilter.mask;
  
  // Find the rope anchor (first body in the rope chain)
  let currentBody = ropeSegment;
  let ropeAnchor = null;
  let constraints = Matter.Composite.allConstraints(engine.world);
  
  // Traverse up the rope to find the anchor
  while (currentBody) {
    let foundConstraint = constraints.find(c => 
      c.bodyB === currentBody && c.bodyA && c.bodyA.label !== 'player'
    );
    
    if (!foundConstraint) break;
    
    currentBody = foundConstraint.bodyA;
    
    if (currentBody.label === 'ropeAnchor') {
      ropeAnchor = currentBody;
      break;
    }
  }
  
  if (!ropeAnchor) {
    console.warn("Could not find rope anchor");
    return;
  }
  
  this.ropeAnchor = ropeAnchor;
  this.grabbedRopeSegment = ropeSegment;
  
  // Calculate the distance from the player to the rope anchor
  const dx = this.body.position.x - ropeAnchor.position.x;
  const dy = this.body.position.y - ropeAnchor.position.y;
  const distance = Math.sqrt(dx*dx + dy*dy);
  
  // Create a constraint between the player and the rope anchor
  this.anchorConstraint = Matter.Constraint.create({
    bodyA: this.body,
    bodyB: ropeAnchor,
    length: distance,
    stiffness: 0.1,
    damping: 0.01
  });
  
  // Create a constraint between the player and the grabbed segment
  this.ropeConstraint = Matter.Constraint.create({
    bodyA: this.body,
    bodyB: ropeSegment,
    length: 0,
    stiffness: 0.2,
    damping: 0.1
  });
  
  // Add constraints to the world
  Matter.World.add(engine.world, [this.anchorConstraint, this.ropeConstraint]);
  
  // Set collision group to prevent player from colliding with the rope
  this.body.collisionFilter.group = -1;
  ropeSegment.collisionFilter.group = -1;
  
  // Preserve player's momentum and convert it to angular momentum
  const playerVelocity = {
    x: this.body.velocity.x,
    y: this.body.velocity.y
  };
  
  // Calculate tangential velocity component (perpendicular to the rope)
  const ropeAngle = Math.atan2(dy, dx);
  const perpAngle = ropeAngle + Math.PI/2;
  
  // Project player velocity onto the perpendicular direction
  const tangentialVelocity = 
    playerVelocity.x * Math.cos(perpAngle) + 
    playerVelocity.y * Math.sin(perpAngle);
  
  // Apply an impulse to create angular momentum
  // The impulse is perpendicular to the rope and proportional to the tangential velocity
  const impulseStrength = tangentialVelocity * this.body.mass * 0.8;
  
  Matter.Body.applyForce(this.body, this.body.position, {
    x: Math.cos(perpAngle) * impulseStrength,
    y: Math.sin(perpAngle) * impulseStrength
  });
  
  // Set flag to indicate player is grabbing rope
  this.isGrabbingRope = true;
  
  // Emit an event that can be used for sound effects or visual feedback
  this.emit("rope.grab", this);
}

releaseRope() {
  if (!this.isGrabbingRope) return;

  console.log("Releasing rope");

  // Store current velocity before removing constraints
  const currentVelocity = {
    x: this.body.velocity.x,
    y: this.body.velocity.y
  };

  // Remove constraints from world
  if (this.ropeConstraint) {
    World.remove(engine.world, this.ropeConstraint);
    this.ropeConstraint = null;
  }
  
  if (this.anchorConstraint) {
    World.remove(engine.world, this.anchorConstraint);
    this.anchorConstraint = null;
  }

  // Restore original collision filters
  if (this.originalPlayerCategory !== undefined && this.grabbedRopeSegment) {
    // Reset player collision filter
    this.body.collisionFilter.group = 0;
    this.body.collisionFilter.category = this.originalPlayerCategory;
    this.body.collisionFilter.mask = this.originalPlayerMask;

    // Reset rope segment collision filter
    if (this.grabbedRopeSegment.collisionFilter) {
      this.grabbedRopeSegment.collisionFilter.group = 0;
      this.grabbedRopeSegment.collisionFilter.category = this.originalRopeCategory;
      this.grabbedRopeSegment.collisionFilter.mask = this.originalRopeMask;
    }
  }

  // Preserve momentum when releasing the rope
  // This prevents the sudden velocity change that can occur when constraints are removed
  Matter.Body.setVelocity(this.body, {
    x: currentVelocity.x * 0.8, // Slightly reduce velocity for more natural feel
    y: currentVelocity.y * 0.8
  });

  // Reset rope grabbing properties
  this.isGrabbingRope = false;
  this.grabbedRopeSegment = null;
  this.ropeAnchor = null;
  this.originalPlayerCategory = undefined;
  this.originalPlayerMask = undefined;
  this.originalRopeCategory = undefined;
  this.originalRopeMask = undefined;

  // Emit an event that can be used for sound effects or visual feedback
  this.emit("rope.release", this);
}
  // Add this to the draw function of the player or in the main draw loop
}

const configPlayerEvents = () => {
  // Get the Events module from Matter.js
  const Events = Matter.Events;
  
  // Add collision detection for rope segments
  Events.on(engine, 'collisionStart', function(event) {
    const pairs = event.pairs;

    // Debug: Log all collision pairs to see what's happening
    console.log("Collision pairs:", pairs.map(p => ({
      bodyA: p.bodyA.label || 'unlabeled',
      bodyB: p.bodyB.label || 'unlabeled'
    })));

    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      
      // Check if collision is between player and rope segment
      const playerBody = player.body;
      const isPlayerInvolved = (pair.bodyA === playerBody || pair.bodyB === playerBody);
      
      if (isPlayerInvolved) {
        const otherBody = pair.bodyA === playerBody ? pair.bodyB : pair.bodyA;
        
        // Debug: Log the other body to see what it is
        console.log("Player collision with:", otherBody.label || 'unlabeled body');
        
        // Check if the other body is a rope segment
        // Try multiple ways to identify rope segments
        const isRopeSegment = 
          otherBody.label === 'ropeSegment' || 
          (otherBody.circleRadius && otherBody.circleRadius < 10) || // Small circles are likely rope segments
          (otherBody.parent && otherBody.parent.label === 'ropeSegment');
        
        if (isRopeSegment) {
          console.log("Rope segment collision detected!");
          
          // Only grab the rope if the player is not already grabbing one
          // and if the player is moving downward (more natural grab)
          if (!player.isGrabbingRope && player.body.velocity.y > 0) {
            player.grabRope(otherBody);
          }
        }
      }
    }
  });

  // Rest of the function remains the same...
}