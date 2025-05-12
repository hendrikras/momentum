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
        this.angleCollisions = [];
        this.died = false;
    }

    // Draw the player on the canvas
    draw() {
        super.draw();
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
        if (JSON.stringify(this.angleCollisions) !== JSON.stringify(angleCollisions)) {
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

        // Add new player physics properties if they don't exist
        if (this.airControl === undefined) {
            // Air control factor - lower means less control in air
            this.airControl = 0.6;
        }

        // Handle slope movement before applying regular movement controls
        let onSlope = false;
        let slopeType = null;
        let slopeModifier = 1.0; // Default modifier (no effect)

        // Check if player is on a slope by examining block types
        if (this.sensors.bottom) {
            // Find the block the player is standing on
            const standingBlock = bodies.find(body =>
                body.type === "block" &&
                body.supports.some(s => Math.round(s.y) === Math.round(this.body.position.y + config.player.height / 2))
            );

            if (standingBlock && standingBlock.t) {
                // Check if it's a slope block - use single slashes
                if (["<", ">", "/", "\\"].includes(standingBlock.t)) {
                    onSlope = true;
                    slopeType = standingBlock.t;

                    // Determine if moving downhill based on slope type and movement direction
                    const movingRight = keys["ArrowRight"] || keys["d"];
                    const movingLeft = keys["ArrowLeft"] || keys["a"];

                    if (movingRight && (slopeType === ">" || slopeType === "\\")) {
                        // Moving right on a right-facing slope (downhill)
                        slopeModifier = 1.3; // Accelerate downhill
                    } else if (movingLeft && (slopeType === "<" || slopeType === "/")) {
                        // Moving left on a left-facing slope (downhill)
                        slopeModifier = 1.3; // Accelerate downhill
                    } else if (movingRight && (slopeType === "<" || slopeType === "/")) {
                        // Moving right on a left-facing slope (uphill)
                        slopeModifier = 0.7; // Decelerate uphill
                    } else if (movingLeft && (slopeType === ">" || slopeType === "\\")) {
                        // Moving left on a right-facing slope (uphill)
                        slopeModifier = 0.7; // Decelerate uphill
                    }
                } else if (standingBlock.t === "0") {
                    // On flat ground - normal movement
                    slopeModifier = 1.0;
                }
            }
        }
        // Handle rope swinging physics
        if (this.isGrabbingRope && this.ropeAnchor) {
            // Calculate the vector from anchor to player
            const dx = this.body.position.x - this.ropeAnchor.position.x;
            const dy = this.body.position.y - this.ropeAnchor.position.y;
            const ropeAngle = Math.atan2(dy, dx);
            const perpAngle = ropeAngle + Math.PI / 2;

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
            }

            // Skip the rest of the normal movement codeƒ
            return;
        } else {

            // Moving Right
            if (keys["ArrowRight"] || keys["d"]) {
                // Apply slope modifier to acceleration
                const effectiveAcceleration = config.player.acceleration * slopeModifier;

                // When moving uphill (right on left-facing slope), use a fixed lower max speed
                if (onSlope && slopeType && (slopeType === "<" || slopeType === "/")) {
                    // Moving right on a left-facing slope (uphill) - use fixed lower speed
                    const uphillMaxSpeed = config.player.speed * 0.7;

                    if (this.speed < uphillMaxSpeed) {
                        // Apply acceleration
                        this.speed += effectiveAcceleration;

                        // Cap at uphillMaxSpeed
                        if (this.speed > uphillMaxSpeed) {
                            this.speed = uphillMaxSpeed;
                        }
                    } else {
                        // Already at or beyond max uphill speed, maintain it
                        this.speed = uphillMaxSpeed;
                    }
                } else {
                    // Calculate max speed including any downhill momentum
                    const maxSpeed = config.player.speed * slopeModifier + (this.downhillMomentum || 0);

                    // Normal movement (downhill or flat)
                    if (this.speed < maxSpeed) {
                        this.speed += effectiveAcceleration;

                        // Cap at max speed
                        if (this.speed > maxSpeed) {
                            this.speed = maxSpeed;
                        }
                    } else {
                        // Gradually approach max speed
                        this.speed += (maxSpeed - this.speed) / config.player.decceleration / 5;
                    }
                }
                this.emit("move.right", this);
            }

            // Moving Left
            if (keys["ArrowLeft"] || keys["a"]) {
                // Apply slope modifier to acceleration
                const effectiveAcceleration = config.player.acceleration * slopeModifier;

                // When moving uphill (left on right-facing slope), use a fixed lower max speed
                if (onSlope && slopeType && (slopeType === ">" || slopeType === "\\")) {
                    // Moving left on a right-facing slope (uphill) - use fixed lower speed
                    const uphillMaxSpeed = config.player.speed * 0.7;

                    // For left movement, we need to handle negative speed values correctly
                    if (this.speed > -uphillMaxSpeed) {
                        // Apply acceleration (which decreases speed since we're moving left)
                        this.speed -= effectiveAcceleration;

                        // Cap at negative uphillMaxSpeed
                        if (this.speed < -uphillMaxSpeed) {
                            this.speed = -uphillMaxSpeed;
                        }
                    } else {
                        // Already at or beyond max uphill speed, maintain it
                        this.speed = -uphillMaxSpeed;
                    }
                } else {
                    // Calculate max speed including any downhill momentum
                    const maxSpeed = config.player.speed * slopeModifier + (this.downhillMomentum || 0);

                    // Normal movement (downhill or flat)
                    if (this.speed > -maxSpeed) {
                        this.speed -= effectiveAcceleration;

                        // Cap at negative max speed
                        if (this.speed < -maxSpeed) {
                            this.speed = -maxSpeed;
                        }
                    } else {
                        // Gradually approach max speed
                        this.speed += (-maxSpeed - this.speed) / config.player.decceleration / 5;
                    }
                }
                this.emit("move.left", this);
            }

            // If not moving right or left, slow down
            if (!keys["ArrowRight"] && !keys["ArrowLeft"] && !keys["a"] && !keys["d"]) {
                // Apply a stronger deceleration on uphill slopes
                const decelerationFactor = onSlope && slopeModifier < 1.0 ? 3 : 1;

                // If we just came off a downhill slope, decelerate more gradually
                if (!onSlope && Math.abs(this.speed) > config.player.speed) {
                    // Gradual deceleration when transitioning from downhill to flat
                    this.speed *= 0.98; // Slow down by 2% each frame
                } else {
                    // Normal deceleration
                    this.speed += -this.speed / (config.player.decceleration / decelerationFactor);
                }
            }

        // Store the previous slope state to detect transitions
            if (!this.prevOnSlope) this.prevOnSlope = false;
            if (!this.prevSlopeType) this.prevSlopeType = null;
            if (!this.downhillMomentum) this.downhillMomentum = 0;

        // Detect transition from downhill slope to flat ground
            if (this.prevOnSlope && !onSlope) {
                // Check if we were on a downhill slope
                const wasMovingDownhill =
                    (this.prevSlopeType === ">" && this.speed > 0) ||
                    (this.prevSlopeType === "\\" && this.speed > 0) ||
                    (this.prevSlopeType === "<" && this.speed < 0) ||
                    (this.prevSlopeType === "/" && this.speed < 0);

                if (wasMovingDownhill) {
                    // Store the excess speed as downhill momentum
                    this.downhillMomentum = Math.abs(this.speed) - config.player.speed;
                    if (this.downhillMomentum < 0) this.downhillMomentum = 0;

                    // Cap the momentum to prevent excessive speeds
                    this.downhillMomentum = Math.min(this.downhillMomentum, config.player.speed * 0.5);
                }
            }

        // Apply downhill momentum to max speed on flat ground
            if (!onSlope && this.downhillMomentum > 0) {
                // Gradually reduce the momentum
                this.downhillMomentum *= 0.98;

                // If momentum is very small, reset it
                if (this.downhillMomentum < 0.1) this.downhillMomentum = 0;
            }

        // Update previous slope state for next frame
            this.prevOnSlope = onSlope;
            this.prevSlopeType = slopeType;
        }
        // Apply Velocity
        bd.setVelocity(this.body, {
            x: this.speed,
            y: constrain(this.body.velocity.y, -config.world.maxYVel, config.world.maxYVel)
        });

        // Jumping and Wall-jumping
        if (keys["ArrowUp"] || keys["w"] || keys[" "]) {
            // Only jump if we haven't just jumped (prevent key holding)
            if (!this.isJumping) {
                audioManager.play("jump");
                // If not touching left and right walls, wall-jump
                if (this.sensors.bottom && !this.sensors.left && !this.sensors.right) {
                    // Track consecutive jumps
                    if (this.consecutiveJumps === undefined) {
                        this.consecutiveJumps = 0;
                    }
                    this.consecutiveJumps++;

                    // Reduce speed based on consecutive jumps (more jumps = more speed reduction)
                    if (this.consecutiveJumps > 1) {
                        // Reduce speed by 15% for each consecutive jump after the first
                        const speedReduction = 0.15 * Math.min(this.consecutiveJumps - 1, 4); // Cap at 60% reduction
                        this.speed *= (1 - speedReduction);
                    }

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

                    // Set jumping flag to prevent multiple jumps from a single key press
                    this.isJumping = true;
                } else {
                    if (config.player.actions.includes("wall jump")) {
                        // Jump off a wall depending on which side the player is touching
                        if (this.sensors.left) {
                            this.speed = config.player.speed / 2;
                            bd.setVelocity(this.body, {
                                x: config.player.jumpForce * 2,
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
                            this.isJumping = true;
                        } else if (this.sensors.right) {
                            this.speed = -config.player.speed / 2;
                            bd.setVelocity(this.body, {
                                x: -config.player.jumpForce * 2,
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
                            this.isJumping = true;
                        }
                    }
                }
            }
        } else {
            // Reset jumping flag when jump key is released
            this.isJumping = false;
        }

        // Reset consecutive jumps counter when player has been on the ground for a while
        if (this.sensors.bottom) {
            if (!this.groundedTime) {
                this.groundedTime = frameCount;
            } else if (frameCount - this.groundedTime > 20) {
                // If player has been on ground for 20 frames, reset consecutive jumps
                this.consecutiveJumps = 0;
            }
        } else {
            this.groundedTime = 0;
        }

        // Dying
        if (this.body.position.y > (levels[level].bitmap.length * config.world.blockSize) + 500) {
            this.died = true;
        }
    }
}