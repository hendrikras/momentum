const configLevel = () => {
  textFade = 255;
  World.clear(engine.world);
  Engine.clear(engine);
  bodies = [];
  for (let y in levels[level].bitmap) {
    let row = levels[level].bitmap[y];
    for (let x in row) {
      let char = row[x];
      if (char !== " ") {
        if (char === "@") {
          player = new Player(Bodies.rectangle(x * config.world.blockSize, y * config.world.blockSize, config.player.width, config.player.height));
          configPlayerEvents();
          bodies.push(player);
        } else {
          bodies.push(new Block(char, x * config.world.blockSize, y * config.world.blockSize));
        }
      }
    }
  }
}

// Add these variables at the top of the file, near other global variables
let gridLines = 20; // Number of grid lines
let horizonY = 200; // Position of the horizon line
let gridColor = 'rgba(255, 255, 255, 0.2)'; // Semi-transparent white for grid lines
let stars = []; // Array to hold star positions
let mountains = []; // Array to hold mountain shapes
let parallaxLayers = 3; // Number of parallax layers
let parallaxSpeed = [0.1, 0.3, 0.6]; // Different speeds for each layer

function setup() {
  createCanvas(800, 400);
  angleMode(RADIANS);
  rectMode(CENTER);
  noStroke();

  engine = Engine.create({
    gravity: {
      y: config.world.gravity
    }
  });
  world = engine.world;
  Matter.Runner.run(engine);

  // Generate stars for the background
  for (let i = 0; i < 100; i++) {
    stars.push({
      x: random(width),
      y: random(horizonY),
      size: random(1, 3),
      brightness: random(150, 255)
    });
  }

  // Generate mountains for the background
  for (let i = 0; i < 5; i++) {
    mountains.push({
      x: random(width),
      width: random(100, 200),
      height: random(50, 100)
    });
  }

  configLevel();
  connectRopeBlocks();
}

// Camera Coordinates
let cameraX = 0, cameraY = 0;
function draw() {
  if(scene === "menu") {
    drawParallaxBackground();
    textFont("Impact", 25);
    textAlign(CENTER, CENTER);
    text("WASD/Arrow keys - Move\nSpacebar/W/Up Arrow - Jump/Walljump\nSHIFT + movement key to dash\n\nClick to start", width/2, height/2);
    if(mouseIsPressed){
      scene = "game";
    }
  }
  else if (scene === "game") {
    // Update camera position
    if (config.world.camera) {
      cameraX += ((width / 2 - player.body.position.x) - cameraX) / config.world.cameraFriction;
      cameraY += ((height / 2 - player.body.position.y) - cameraY) / config.world.cameraFriction
    }

    // Draw parallax background
    drawParallaxBackground();

    // Draw game elements
    push();
    translate(cameraX, cameraY);

    bodies.forEach(body => {
      body.run();
      body.draw();
    });

    pop();

    if(levels[level].message){
      textFont("Impact", 25);
      fill(0, textFade);
      textAlign(CENTER, CENTER);
      text(levels[level].message, width/2 - 2, height/2 - 2);
      text(levels[level].message, width/2 - 2, height/2 + 2);
      text(levels[level].message, width/2 + 2, height/2 - 2);
      text(levels[level].message, width/2 + 2, height/2 + 2);
      fill(255, textFade);
      text(levels[level].message, width/2, height/2);
      if(textFade > 0){
        textFade -= 1;
      }
    }

    if (player.died) {
      configLevel();
      player.died = false;
    }

    if (nextLevel) {
      if (levels[level + 1]) {
        level++;
        configLevel();
        nextLevel = false;
      } else {
        scene = "win"
      }
    }
  }
  else if(scene === "win") {
    drawParallaxBackground();
    textFont("Impact", 25);
    textAlign(CENTER, CENTER);
    fill(0);
    text("You Won!", width/2, height/2);
  }
}

// Function to draw the parallax background
function drawParallaxBackground() {
  // Calculate vertical parallax based on player's relative position in the level
  // We need to determine the level bounds first
  let levelHeight = 0;
  let playerRelativeHeight = 0;
  
  if (scene === "game" && player) {
    // Find the highest and lowest points in the current level
    let minY = Infinity;
    let maxY = -Infinity;
    
    // Iterate through all level rows to find boundaries
    for (let y in levels[level].bitmap) {
      if (parseInt(y) < minY) minY = parseInt(y);
      if (parseInt(y) > maxY) maxY = parseInt(y);
    }
    
    // Calculate total level height in pixels
    levelHeight = (maxY - minY + 1) * config.world.blockSize;
    
    // Calculate player's relative position (0 at bottom, 1 at top)
    let playerY = player.body.position.y;
    let bottomY = maxY * config.world.blockSize;
    let topY = minY * config.world.blockSize;
    
    playerRelativeHeight = map(playerY, bottomY, topY, 0, 1);
    playerRelativeHeight = constrain(playerRelativeHeight, 0, 1);
  }
  
  // Use a more subtle parallax effect (reduced from 0.4 to 0.25)
  // Scale based on player's relative height in the level
  let verticalParallax = -cameraY * 0.25 * playerRelativeHeight;
  
  // Adjust horizon based on vertical camera position
  let adjustedHorizonY = horizonY + verticalParallax;

  // Constrain the horizon movement to a narrower range for subtler effect
  adjustedHorizonY = constrain(adjustedHorizonY, horizonY - 60, horizonY + 60);

  // Sky gradient (dark at top to lighter at horizon)
  noStroke();
  for (let y = 0; y < adjustedHorizonY; y++) {
    let inter = map(y, 0, adjustedHorizonY, 0, 1);
    let c = lerpColor(color(20, 24, 82), color(75, 61, 96), inter);
    stroke(c);
    line(0, y, width, y);
  }
  noStroke();

  // Draw stars with twinkling effect
  for (let star of stars) {
    // Calculate star position with parallax effect based on camera movement
    let parallaxX = star.x + (cameraX * (star.size / 5)); // Smaller stars move slower (appear further)

    // Adjust star's vertical position based on horizon movement
    let starY = star.y * (adjustedHorizonY / horizonY);

    // Wrap stars around the screen
    if (parallaxX < 0) parallaxX += width;
    if (parallaxX > width) parallaxX -= width;

    // Only draw stars above the horizon
    if (starY < adjustedHorizonY) {
      // Twinkle effect
      let twinkle = sin(frameCount * 0.05 + star.x) * 20 + star.brightness;
      fill(255, 255, 255, twinkle);
      ellipse(parallaxX, starY, star.size);
    }
  }

  // Ground gradient (from horizon to bottom)
  for (let y = adjustedHorizonY; y < height; y++) {
    let inter = map(y, adjustedHorizonY, height, 0, 1);
    let c = lerpColor(color(100, 90, 120), color(50, 40, 60), inter);
    stroke(c);
    line(0, y, width, y);
  }

  // Draw grid lines with parallax effect
  stroke(gridColor);
  strokeWeight(1);

  // Horizontal grid lines - now starting from the adjusted horizon
  for (let i = 0; i < gridLines; i++) {
    let y = map(i, 0, gridLines - 1, adjustedHorizonY, height);
    line(0, y, width, y);
  }

  // Vertical grid lines with perspective effect
  // Increase the range to ensure grid covers entire visible area
  for (let i = -gridLines * 2; i < gridLines * 3; i++) {
    // Make the parallax effect more pronounced for vertical lines
    let parallaxOffset = (cameraX * 0.8) % (width / gridLines);

    // Calculate the base position of each vertical line
    let x = (i * (width / gridLines)) + parallaxOffset;

    // Widen the range of top endpoints to extend beyond screen edges
    // This creates a more immersive grid without visible edges
    let topX = map(i, -gridLines * 2, gridLines * 3, -width * 0.2, width * 1.2);

    // Only draw if the line will be visible on screen (optimization)
    if (x >= -50 && x <= width + 50 || topX >= -50 && topX <= width + 50) {
      // Draw the line from the bottom of the screen to the adjusted horizon
      line(x, height, topX, adjustedHorizonY);
    }
  }

  // Redraw the horizon line with the new position to create a clean transition
  stroke(gridColor);
  strokeWeight(2); // Slightly thicker for emphasis
  line(0, adjustedHorizonY, width, adjustedHorizonY);
  
  // Add distant mountains with parallax effect
  noStroke();
  fill(60, 50, 80, 180);
  for (let mountain of mountains) {
    // Apply horizontal parallax to mountains
    let mountainX = mountain.x + (cameraX * 0.15);
    // Apply vertical parallax - mountains should follow the horizon
    let mountainY = adjustedHorizonY - (mountain.height * 0.5);

    // Wrap mountains around screen
    if (mountainX < -mountain.width) mountainX += width + mountain.width;
    if (mountainX > width + mountain.width) mountainX -= width + mountain.width;

    // Draw mountain
    triangle(
      mountainX, mountainY + mountain.height,
      mountainX - mountain.width/2, mountainY,
      mountainX + mountain.width/2, mountainY
    );
  }

  // Add clouds that move with vertical parallax
  fill(255, 255, 255, 80);
  // Use frameCount to slowly move clouds horizontally over time
  let cloudOffset = frameCount * 0.2;

  for (let i = 0; i < 5; i++) {
    // Position clouds at different heights relative to the adjusted horizon
    let cloudY = adjustedHorizonY - 50 - i * 20;
    // Only draw clouds if they're above the bottom of the screen
    if (cloudY < height) {
      // Create cloud shapes that move with both horizontal and vertical parallax
      let cloudX = ((i * 200) + cloudOffset) % (width + 400) - 200;
      ellipse(cloudX, cloudY, 80, 40);
      ellipse(cloudX + 40, cloudY - 10, 70, 30);
      ellipse(cloudX - 40, cloudY - 5, 60, 25);
    }
  }
  
  noStroke();
}
function keyPressed() {
  keys[key] = true;
}
function keyReleased() {
  keys[key] = false;
}