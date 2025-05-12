class Hero extends PlayerSwing {
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
        let headOffset = -h / 2 + headHeight / 2; // Position head at top of character

        // Draw the body first - ensure it stays within physics bounds
        stroke("#050b55");
        strokeWeight(w / 8);
        noFill();

        // Torso - shorter to accommodate head
        let torsoTop = -h / 2 + headHeight;
        let torsoBottom = h / 4; // Shorter torso
        line(0, torsoTop, 0, torsoBottom);

        // Arms - improved natural movement
        let shoulderY = torsoTop + (torsoBottom - torsoTop) * 0.2; // Shoulders at 20% down the torso
        let armLength = w * 0.25; // Shorter arms to stay within bounds

        // More natural arm movement during running
        let leftArmAngle, rightArmAngle;

        if (isRunning) {
            // Opposite arm-leg movement (when left leg forward, right arm forward)
            leftArmAngle = sin(runCycle * TWO_PI + PI) * PI / 4; // Offset by PI to be opposite of legs
            rightArmAngle = sin(runCycle * TWO_PI) * PI / 4;
        } else if (isJumping) {
            // Arms up when jumping
            leftArmAngle = -PI / 4;
            rightArmAngle = -PI / 4;
        } else {
            // Slight angle when idle
            leftArmAngle = PI / 8;
            rightArmAngle = PI / 8;
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
            leftElbowBend = map(sin(runCycle * TWO_PI + PI / 2), -1, 1, PI / 8, PI / 3);
        } else if (isJumping) {
            // Bent elbows when jumping
            leftElbowBend = PI / 4;
        } else {
            // Slight bend when idle
            leftElbowBend = PI / 6;
        }

        translate(armLength, 0);
        rotate(leftElbowBend);
        line(0, 0, armLength * 0.8, 0); // Lower arm (slightly shorter)
        pop();

        // Right arm with improved elbow bend
        push();
        translate(0, shoulderY);
        rotate(rightArmAngle); // Negative to mirror the left arm
        line(0, 0, armLength, 0); // Upper arm

        // Elbow bends more naturally
        let rightElbowBend;
        if (isRunning) {
            // Elbow bends more during running, synchronized with arm swing
            rightElbowBend = map(sin(runCycle * TWO_PI - PI / 2), -1, 1, PI / 8, PI / 3);
        } else if (isJumping) {
            // Bent elbows when jumping
            rightElbowBend = PI / 4;
        } else {
            // Slight bend when idle
            rightElbowBend = PI / 6;
        }

        translate(armLength, 0);
        rotate(rightElbowBend);
        line(0, 0, armLength * 0.8, 0); // Lower arm (slightly shorter)
        pop();
        scale(-1, 1);
        // Legs - improved natural movement
        let hipY = torsoBottom;
        let legLength = h * 0.25; // Shorter legs

        // More natural leg movement during running
        let leftLegAngle, rightLegAngle;

        if (isJumping) {
            // Legs tucked up slightly when jumping
            leftLegAngle = -PI / 6;
            rightLegAngle = -PI / 6;
        } else if (isRunning) {
            // Running cycle for legs
            leftLegAngle = sin(runCycle * TWO_PI) * PI / 4;
            rightLegAngle = sin(runCycle * TWO_PI + PI) * PI / 4; // Offset by PI to alternate with left leg
        } else {
            // Standing straight when idle
            leftLegAngle = 0;
            rightLegAngle = 0;
        }


        // Left leg with improved knee bend
        push();
        translate(0, hipY);
        rotate(leftLegAngle);
        line(0, 0, 0, legLength); // Upper leg

        // Knee bends more naturally
        let leftKneeBend;
        if (isJumping) {
            // Bent knees when jumping
            leftKneeBend = PI / 4;
        } else if (isRunning) {
            // Knee bends more during running, synchronized with leg swing
            leftKneeBend = map(sin(runCycle * TWO_PI - PI / 4), -1, 1, 0, PI / 3);
        } else {
            // Slight bend when idle
            leftKneeBend = PI / 20;
        }

        translate(0, legLength);
        rotate(leftKneeBend);
        line(0, 0, 0, legLength); // Lower leg

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
            rightKneeBend = map(sin(runCycle * TWO_PI + 3 * PI / 4), -1, 1, 0, PI / 3);
        } else if (isJumping) {
            // Bent knees when jumping
            rightKneeBend = PI / 4;
        } else {
            // Slight bend when idle
            rightKneeBend = PI / 20;
        }

        translate(0, legLength);
        rotate(rightKneeBend);
        line(0, 0, 0, legLength); // Lower leg

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
}