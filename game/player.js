class Player extends Body {
  constructor(body) {
    super(body, "player");
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
    let h = config.player.height;

    // Animation parameters
    let runCycle = (frameCount % 20) / 20; // 0 to 1 over 20 frames
    let isRunning = Math.abs(this.speed) > 0.1;
    let isJumping = !this.sensors.bottom;
    let direction = this.speed > 0 ? 1 : -1;

    push(); // Save the current drawing state
    translate(pos.x, pos.y);
    scale(direction, 1); // Flip horizontally based on direction

    // Head
    fill(255);
    stroke(0);
    strokeWeight(2);
    ellipse(0, -h/2 + w/4, w/2, w/2);

    // Body
    line(0, -h/2 + w/4, 0, h/2 - w/4);

    // Arms
    let armAngle = isRunning ? sin(runCycle * TWO_PI) * PI/6 : (isJumping ? -PI/4 : PI/6);
    line(0, -h/4, cos(armAngle) * w/2, sin(armAngle) * w/2);
    line(0, -h/4, cos(armAngle + PI) * w/2, sin(armAngle + PI) * w/2);

    // Legs
    let legAngle = isRunning ? sin(runCycle * TWO_PI + PI/2) * PI/6 : (isJumping ? PI/6 : 0);
    line(0, h/2 - w/4, cos(legAngle) * w/3, h/2 + sin(legAngle) * w/3);
    line(0, h/2 - w/4, cos(legAngle + PI) * w/3, h/2 + sin(legAngle + PI) * w/3);

    // Eyes
    fill(0);
    noStroke();
    ellipse(-w/8, -h/2 + w/4, w/8, w/8);
    ellipse(w/8, -h/2 + w/4, w/8, w/8);

    // Mouth
    noFill();
    stroke(0);
    arc(0, -h/2 + w/3, w/4, w/8, 0, PI);

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

    // Update player position if standing on a moving platform
    if (this.standingOn && this.standingOn.isMoving) {
      let dx = this.standingOn.body.position.x - this.standingOn.previousPosition.x;
      let dy = this.standingOn.body.position.y - this.standingOn.previousPosition.y;
      bd.translate(this.body, { x: dx, y: dy });
    }
    // Jumping and Wall-jumping
    if (keys["ArrowUp"] || keys["w"] || keys[" "]) {
      if (this.sensors.bottom) {
        bd.setVelocity(this.body, { x: this.body.velocity.x, y: -config.player.jumpForce });
        this.sensors.bottom = false;
        this.standingOn = null;
        this.emit("jump.up", this);
      } else if (config.player.actions.includes("wall jump")) {
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
}

const configPlayerEvents = () => {
  player.on("update", () => {
    
  })

  player.on("collide", (angles) => {

  });

  player.on("dash", (p) => {
    
  });

  player.on("jump.up", (p) => {
    
  })

  player.on("jump.left", (p) => {
    
  })

  player.on("jump.right", (p) => {
    
  })

  player.on("move.left", (p) => {
    
  })

  player.on("move.right", (p) => {
    
  })
}