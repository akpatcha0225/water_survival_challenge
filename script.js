// --- Game Config ---
const difficultySettings = {
    easy: {
        waterPerDay: 25,
        timerDuration: 75,
        thresholds: {drinking: 1, cooking: 2, cleaning: 1, hygiene: 1},
        ideal: {drinking: 4, cooking: 6, cleaning: 5, hygiene: 4},
        scoreMultiplier: 0.8,
        waterDropCount: 5
    },
    normal: {
        waterPerDay: 20,
        timerDuration: 60,
        thresholds: {drinking: 2, cooking: 3, cleaning: 2, hygiene: 2},
        ideal: {drinking: 3, cooking: 5, cleaning: 4, hygiene: 3},
        scoreMultiplier: 1,
        waterDropCount: 4
    },
    hard: {
        waterPerDay: 15,
        timerDuration: 45,
        thresholds: {drinking: 3, cooking: 4, cleaning: 3, hygiene: 3},
        ideal: {drinking: 4, cooking: 6, cleaning: 5, hygiene: 4},
        scoreMultiplier: 1.2,
        waterDropCount: 3
    }
};
const totalDays = 7;

let currentDifficulty = 'normal';
let waterPerDay = difficultySettings[currentDifficulty].waterPerDay;
let timerDuration = difficultySettings[currentDifficulty].timerDuration;
let thresholds = {...difficultySettings[currentDifficulty].thresholds};
let ideal = {...difficultySettings[currentDifficulty].ideal};
let scoreMultiplier = difficultySettings[currentDifficulty].scoreMultiplier;

let currentDay = 1;
let timer = timerDuration;
let paused = false;
let timerInterval;
let allocations = {
    drinking: 0,
    cooking: 0,
    cleaning: 0,
    hygiene: 0
};
let bonusWater = 0;
let waterAllocated = 0;
let survivedAll = true;
let totalScore = 0;
let shownMilestones = new Set();

const milestones = [
    { score: 5, message: "Getting started!" },
    { score: 10, message: "Halfway there!" },
    { score: 15, message: "You're doing great!" },
    { score: 20, message: "Almost there!" },
    { score: 25, message: "Master survivor!" }
];

const events = [
    { desc: "Pipe leak! You lose 2 liters of water.", effect: { water: -2 } },
    { desc: "A guest arrives. You need 1 extra liter for drinking.", effect: { drinking: 1 } },
    { desc: "Heavy rain! You collect 3 extra liters.", effect: { water: 3 } },
    { desc: "Cooking mishap. You waste 1 liter.", effect: { cooking: -1 } },
    { desc: "Hygiene emergency. You need 1 extra liter.", effect: { hygiene: 1 } },
    { desc: "Cleaning day. You need 1 extra liter.", effect: { cleaning: 1 } },
    { desc: "No event today.", effect: {} }
];

// --- DOM Elements ---
const startBtn = document.getElementById('start-btn');
const allocateBtn = document.getElementById('allocate-btn');
const pauseBtn = document.getElementById('pause-btn');
const unpauseBtn = document.getElementById('unpause-btn');
const eventContinueBtn = document.getElementById('event-continue-btn');
const nextDayBtn = document.getElementById('next-day-btn');
const restartBtn = document.getElementById('restart-btn');
const resetBtn = document.getElementById('reset-btn');

const dayNumber = document.getElementById('day-number');
const availableWater = document.getElementById('available-water');
const allocatedWaterLabel = document.getElementById('allocated-water-label');
const waterProgressBar = document.getElementById('water-progress-bar');
const timerDisplay = document.getElementById('timer');
const difficultyRadios = document.querySelectorAll('input[name="difficulty"]');
const dropContainer = document.getElementById('drop-container');

const drinkingSlider = document.getElementById('drinking-slider');
const cookingSlider = document.getElementById('cooking-slider');
const cleaningSlider = document.getElementById('cleaning-slider');
const hygieneSlider = document.getElementById('hygiene-slider');

const drinkingValue = document.getElementById('drinking-value');
const cookingValue = document.getElementById('cooking-value');
const cleaningValue = document.getElementById('cleaning-value');
const hygieneValue = document.getElementById('hygiene-value');

// --- Event Listeners ---
startBtn.addEventListener('click', startGame);
allocateBtn.addEventListener('click', allocateWater);
// Pause modal removed, so no listeners needed
eventContinueBtn.addEventListener('click', continueAfterEvent);
nextDayBtn.addEventListener('click', nextDay);
restartBtn.addEventListener('click', restartGame);
resetBtn.addEventListener('click', restartGame);
resetBtn.addEventListener('click', restartGame);

[drinkingSlider, cookingSlider, cleaningSlider, hygieneSlider].forEach(slider => {
    slider.addEventListener('input', updateValues);
});

difficultyRadios.forEach(radio => {
    radio.addEventListener('change', () => {
        currentDifficulty = radio.value;
        applyDifficultySettings();
    });
});

// --- Functions ---
function updateValues() {
    allocations.drinking = parseInt(drinkingSlider.value);
    allocations.cooking = parseInt(cookingSlider.value);
    allocations.cleaning = parseInt(cleaningSlider.value);
    allocations.hygiene = parseInt(hygieneSlider.value);

    drinkingValue.textContent = allocations.drinking + 'L';
    cookingValue.textContent = allocations.cooking + 'L';
    cleaningValue.textContent = allocations.cleaning + 'L';
    hygieneValue.textContent = allocations.hygiene + 'L';

    waterAllocated = allocations.drinking + allocations.cooking + allocations.cleaning + allocations.hygiene;
    const totalAvailable = waterPerDay + bonusWater;
    const remaining = Math.max(0, totalAvailable - waterAllocated);
    availableWater.textContent = remaining;
    allocatedWaterLabel.textContent = waterAllocated + 'L / ' + totalAvailable + 'L';
    let percent = Math.min(100, (waterAllocated / Math.max(1, totalAvailable)) * 100);
    waterProgressBar.style.width = percent + '%';
}

function setSliderMax() {
    const totalAvailable = waterPerDay + bonusWater;
    [drinkingSlider, cookingSlider, cleaningSlider, hygieneSlider].forEach(slider => {
        slider.max = totalAvailable;
    });
}

function applyDifficultySettings() {
    const settings = difficultySettings[currentDifficulty] || difficultySettings.normal;
    waterPerDay = settings.waterPerDay;
    timerDuration = settings.timerDuration;
    thresholds = {...settings.thresholds};
    ideal = {...settings.ideal};
    scoreMultiplier = settings.scoreMultiplier;
    bonusWater = 0;

    // Update threshold labels for player clarity
    document.querySelectorAll('.cat-min')[0].textContent = `Min: ${thresholds.drinking}L | Ideal: ${ideal.drinking}L`;
    document.querySelectorAll('.cat-min')[1].textContent = `Min: ${thresholds.cooking}L | Ideal: ${ideal.cooking}L`;
    document.querySelectorAll('.cat-min')[2].textContent = `Min: ${thresholds.cleaning}L | Ideal: ${ideal.cleaning}L`;
    document.querySelectorAll('.cat-min')[3].textContent = `Min: ${thresholds.hygiene}L | Ideal: ${ideal.hygiene}L`;

    setSliderMax();
    updateValues();
    generateWaterDrops();
}

function generateWaterDrops() {
    dropContainer.innerHTML = '';
    const count = difficultySettings[currentDifficulty]?.waterDropCount || 4;
    for (let i = 0; i < count; i++) {
        const drop = document.createElement('div');
        drop.className = 'water-drop';
        drop.textContent = '💧';
        drop.title = 'Click to collect +1L water';
        drop.addEventListener('click', () => {
            if (drop.classList.contains('collected')) return;
            drop.classList.add('collected');
            drop.remove();
            bonusWater += 1;
            updateValues();
        });
        dropContainer.appendChild(drop);
    }
}

function startGame() {
    // Apply selected difficulty settings and hide all screens except allocation
    applyDifficultySettings();
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('event-screen').classList.add('hidden');
    document.getElementById('outcome-screen').classList.add('hidden');
    document.getElementById('end-screen').classList.add('hidden');
    document.getElementById('allocation-screen').classList.remove('hidden');
    // Reset game state
    currentDay = 1;
    survivedAll = true;
    dayNumber.textContent = currentDay;
    resetAllocations();
    startTimer();
}

function resetAllocations() {
    drinkingSlider.value = 0;
    cookingSlider.value = 0;
    cleaningSlider.value = 0;
    hygieneSlider.value = 0;
    updateValues();
}

function startTimer() {
    timer = timerDuration;
    timerDisplay.textContent = timer;
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (!paused) {
            timer--;
            timerDisplay.textContent = timer;
            if (timer <= 0) {
                clearInterval(timerInterval);
                allocateWater(); // Auto allocate if time runs out
            }
        }
    }, 1000);
}



function allocateWater() {
    clearInterval(timerInterval);
    waterAllocated = allocations.drinking + allocations.cooking + allocations.cleaning + allocations.hygiene;
    const totalAvailable = waterPerDay + bonusWater;
    if (waterAllocated > totalAvailable) {
        alert("You allocated more water than available!");
        return;
    }
    // Random event
    const event = events[Math.floor(Math.random() * events.length)];
    document.getElementById('event-description').textContent = event.desc;
    // Apply event effects
    if (event.effect.water) {
        // If water is lost/gained, adjust available for outcome check
        waterAllocated -= event.effect.water;
        // If negative, player loses water, so allocations are less effective
    }
    if (event.effect.drinking) allocations.drinking += event.effect.drinking;
    if (event.effect.cooking) allocations.cooking += event.effect.cooking;
    if (event.effect.cleaning) allocations.cleaning += event.effect.cleaning;
    if (event.effect.hygiene) allocations.hygiene += event.effect.hygiene;

    document.getElementById('allocation-screen').classList.add('hidden');
    document.getElementById('event-screen').classList.remove('hidden');
}

function continueAfterEvent() {
    document.getElementById('event-screen').classList.add('hidden');
    checkOutcome();
}

function checkOutcome() {
    let survived = true;
    let message = `Day ${currentDay} survived!\n`;
    if (allocations.drinking < thresholds.drinking) {
        survived = false;
        message += "Not enough water for drinking.\n";
    }
    if (allocations.cooking < thresholds.cooking) {
        survived = false;
        message += "Not enough water for cooking.\n";
    }
    if (allocations.cleaning < thresholds.cleaning) {
        survived = false;
        message += "Not enough water for cleaning.\n";
    }
    if (allocations.hygiene < thresholds.hygiene) {
        survived = false;
        message += "Not enough water for hygiene.\n";
    }

    if (!survived) {
        message += "Game Over!";
        survivedAll = false;
        document.getElementById('outcome-message').textContent = message;
        document.getElementById('milestone-message').textContent = '';
        document.getElementById('next-day-btn').textContent = "End Game";
        document.getElementById('outcome-screen').classList.remove('hidden');
    } else {
        message += "Well done!";
        // Calculate daily score and add to total
        let dailyScore = 0;
        dailyScore += Math.max(0, Math.min(allocations.drinking, ideal.drinking) - thresholds.drinking);
        dailyScore += Math.max(0, Math.min(allocations.cooking, ideal.cooking) - thresholds.cooking);
        dailyScore += Math.max(0, Math.min(allocations.cleaning, ideal.cleaning) - thresholds.cleaning);
        dailyScore += Math.max(0, Math.min(allocations.hygiene, ideal.hygiene) - thresholds.hygiene);
        dailyScore = Math.round(dailyScore * scoreMultiplier);
        totalScore += dailyScore;

        // Check for milestones
        let milestoneMessage = '';
        for (let milestone of milestones) {
            if (totalScore >= milestone.score && !shownMilestones.has(milestone.score)) {
                milestoneMessage = milestone.message;
                shownMilestones.add(milestone.score);
                break; // Show only the first new milestone reached
            }
        }

        document.getElementById('outcome-message').textContent = message;
        document.getElementById('milestone-message').textContent = milestoneMessage;
        document.getElementById('next-day-btn').textContent = currentDay === totalDays ? "See Results" : "Next Day";
        document.getElementById('outcome-screen').classList.remove('hidden');
    }
}

function nextDay() {
    if (!survivedAll) {
        endGame(false);
        return;
    }

    if (currentDay >= totalDays) {
        endGame(true);
        return;
    }

    currentDay++;
    dayNumber.textContent = currentDay;
    document.getElementById('outcome-screen').classList.add('hidden');
    document.getElementById('allocation-screen').classList.remove('hidden');
    resetAllocations();
    generateWaterDrops();
    startTimer();
}

function endGame(success) {
    document.getElementById('outcome-screen').classList.add('hidden');
    document.getElementById('end-screen').classList.remove('hidden');
    if (success) {
        document.getElementById('end-message').textContent = "Congratulations! You survived all 7 days.";
        document.getElementById('score-value').textContent = totalScore + " (" + currentDifficulty + " mode)";
    } else {
        document.getElementById('end-message').textContent = "You didn't survive all days.";
        document.getElementById('score-value').textContent = totalScore + " (" + currentDifficulty + " mode)";
    }
}

function restartGame() {
    currentDay = 1;
    timer = timerDuration;
    paused = false;
    if (timerInterval) clearInterval(timerInterval);
    allocations = {
        drinking: 0,
        cooking: 0,
        cleaning: 0,
        hygiene: 0
    };
    waterAvailable = waterPerDay;
    waterAllocated = 0;
    survivedAll = true;
    totalScore = 0;
    shownMilestones.clear();
    dayNumber.textContent = currentDay;
    timerDisplay.textContent = timer;
    drinkingSlider.value = 0;
    cookingSlider.value = 0;
    cleaningSlider.value = 0;
    hygieneSlider.value = 0;
    updateValues();
    document.getElementById('allocation-screen').classList.add('hidden');
    document.getElementById('event-screen').classList.add('hidden');
    document.getElementById('outcome-screen').classList.add('hidden');
    document.getElementById('end-screen').classList.add('hidden');
    document.getElementById('start-screen').classList.remove('hidden');
    document.getElementById('restart-btn').classList.add('hidden');
    document.getElementById('next-day-btn').classList.remove('hidden');
}

// --- Initialize UI ---
updateValues();
// Pause modal removed