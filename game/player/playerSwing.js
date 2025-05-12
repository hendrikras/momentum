class PlayerSwing extends Player {
    grabRope(ropeSegment) {
        if (this.isGrabbingRope) return; // Already grabbing a rope

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
        const distance = Math.sqrt(dx * dx + dy * dy);

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
        const perpAngle = ropeAngle + Math.PI / 2;

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
}

const configPlayerEvents = () => {
    // Get the Events module from Matter.js
    const Events = Matter.Events;

    // Add collision detection for rope segments
    Events.on(engine, 'collisionStart', function (event) {
        const pairs = event.pairs;

        for (let i = 0; i < pairs.length; i++) {
            const pair = pairs[i];

            // Check if collision is between player and rope segment
            const playerBody = player.body;
            const isPlayerInvolved = (pair.bodyA === playerBody || pair.bodyB === playerBody);

            if (isPlayerInvolved) {
                const otherBody = pair.bodyA === playerBody ? pair.bodyB : pair.bodyA;

                // Check if the other body is a rope segment
                // Try multiple ways to identify rope segments
                const isRopeSegment =
                    otherBody.label === 'ropeSegment' ||
                    (otherBody.circleRadius && otherBody.circleRadius < 10) || // Small circles are likely rope segments
                    (otherBody.parent && otherBody.parent.label === 'ropeSegment');

                if (isRopeSegment) {
                    // Only grab the rope if the player is not already grabbing one
                    // and if the player is moving downward (more natural grab)
                    if (!player.isGrabbingRope && player.body.velocity.y > 0) {
                        player.grabRope(otherBody);
                    }
                }
            }
        }
    });
}