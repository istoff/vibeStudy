// Game state
const gameState = {
    currentPosition: 0,
    currentScore: 0,
    targetScore: 50,
    currentTopic: 'networking',
    boardSize: 30,
    specialSpaces: {
        5: { type: 'bonus', value: 5 },
        10: { type: 'penalty', value: -3 },
        15: { type: 'bonus', value: 7 },
        20: { type: 'penalty', value: -5 },
        25: { type: 'question' },
        29: { type: 'question' }
    },
    questions: {}
};

// DOM elements
const startScreen = document.getElementById('start-screen');
const gameBoard = document.getElementById('game-board');
const boardElement = document.getElementById('board');
const rollDiceBtn = document.getElementById('roll-dice');
const questionModal = document.getElementById('question-modal');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const referenceLinks = document.getElementById('reference-links');
const currentScoreDisplay = document.getElementById('current-score');
const targetScoreDisplay = document.getElementById('target-score-display');
const examTopicSelect = document.getElementById('exam-topic');
const targetScoreInput = document.getElementById('target-score');
const startGameBtn = document.getElementById('start-game');
const adminBtn = document.getElementById('admin-btn');
const diceResult = document.getElementById('dice-result');
const answerFeedback = document.getElementById('answer-feedback');

// Initialize the game
async function initGame() {
    // Load available topics from server
    try {
        const response = await fetch('http://localhost:5000/api/topics');
        if (!response.ok) throw new Error('Failed to load topics');
        const topics = await response.json();
        
        // Populate topic dropdown
        examTopicSelect.innerHTML = topics.map(topic => 
            `<option value="${topic.name}">${topic.name}</option>`
        ).join('');
        
        // Set default topic
        if (topics.length > 0) {
            gameState.currentTopic = topics[0].name;
        }
    } catch (error) {
        console.error('Error loading topics:', error);
        alert('Failed to load topics');
    }
    
    // Load questions for selected topic
    loadQuestions(gameState.currentTopic);
    
    // Set up event listeners
    startGameBtn.addEventListener('click', startGame);
    rollDiceBtn.addEventListener('click', rollDice);
    adminBtn.addEventListener('click', () => {
        window.location.href = 'admin.html';
    });
    
    // Initialize board
    renderBoard();
}

// Load questions from server
async function loadQuestions(topic) {
    try {
        const response = await fetch(`http://localhost:5000/api/questions/${topic}`);
        if (!response.ok) throw new Error('Failed to load questions');
        
        const data = await response.json();
        gameState.questions = { 
            categories: data.map(q => ({
                name: q.category,
                questions: [{
                    question: q.question,
                    options: q.options,
                    references: q.references
                }]
            }))
        };
    } catch (error) {
        console.error(`Error loading questions for ${topic}:`, error);
        gameState.questions = { categories: [] };
        alert('Failed to load questions');
    }
}

// Render the game board
function renderBoard() {
    boardElement.innerHTML = '';
    for (let i = 0; i < gameState.boardSize; i++) {
        const space = document.createElement('div');
        space.className = 'board-space';
        space.textContent = i + 1;
        
        if (i === gameState.currentPosition) {
            space.classList.add('player');
        }
        
        if (gameState.specialSpaces[i]) {
            space.classList.add('special');
            switch (gameState.specialSpaces[i].type) {
                case 'bonus':
                    space.textContent = '+';
                    break;
                case 'penalty':
                    space.textContent = '-';
                    break;
                case 'question':
                    space.textContent = '?';
                    break;
            }
        }
        
        boardElement.appendChild(space);
    }
}

// Start the game
function startGame() {
    gameState.currentTopic = examTopicSelect.value;
    gameState.targetScore = parseInt(targetScoreInput.value);
    gameState.currentScore = 0;
    gameState.currentPosition = 0;
    
    targetScoreDisplay.textContent = gameState.targetScore;
    currentScoreDisplay.textContent = gameState.currentScore;
    
    loadQuestions(gameState.currentTopic);
    
    startScreen.classList.add('hidden');
    gameBoard.classList.remove('hidden');
    
    renderBoard();
}

// Roll dice and move player
function rollDice() {
    rollDiceBtn.classList.add('dice-rolling');
    rollDiceBtn.disabled = true;
    answerFeedback.textContent = '';
    
    setTimeout(() => {
        const diceRoll = Math.floor(Math.random() * 6) + 1;
        diceResult.textContent = `You rolled a ${diceRoll}`;
        movePlayer(diceRoll);
        rollDiceBtn.classList.remove('dice-rolling');
        rollDiceBtn.disabled = false;
        
        // Show question after every move (not just on question spaces)
        if (Math.random() > 0.3) { // 70% chance of question
            setTimeout(showQuestion, 500);
        }
    }, 500);
}

// Move player on the board
function movePlayer(spaces) {
    const newPosition = (gameState.currentPosition + spaces) % gameState.boardSize;
    gameState.currentPosition = newPosition;
    
    // Animate movement
    const playerElement = document.querySelector('.board-space.player');
    if (playerElement) {
        playerElement.classList.remove('player');
        playerElement.classList.add('player-move');
        
        setTimeout(() => {
            playerElement.classList.remove('player-move');
            renderBoard();
            checkSpaceEffect();
        }, 500);
    }
}

// Check if player landed on a special space
function checkSpaceEffect() {
    const space = gameState.specialSpaces[gameState.currentPosition];
    if (!space) return;
    
    switch (space.type) {
        case 'bonus':
        case 'penalty':
            updateScore(space.value);
            break;
        case 'question':
            showQuestion();
            break;
    }
}

// Update player score
function updateScore(points) {
    gameState.currentScore = Math.max(0, gameState.currentScore + points);
    currentScoreDisplay.textContent = gameState.currentScore;
    
    if (gameState.currentScore >= gameState.targetScore) {
        setTimeout(() => {
            alert('Congratulations! You won the game!');
            resetGame();
        }, 500);
    }
}

// Show question modal
function showQuestion() {
    // Get random category
    const categories = gameState.questions.categories;
    if (!categories || categories.length === 0) {
        alert('No questions available for this topic!');
        return;
    }
    
    const randomCategory = categories[Math.floor(Math.random() * categories.length)];
    const randomQuestion = randomCategory.questions[Math.floor(Math.random() * randomCategory.questions.length)];
    
    questionText.textContent = randomQuestion.question;
    optionsContainer.innerHTML = '';
    referenceLinks.innerHTML = '';
    
    // Add options
    randomQuestion.options.forEach((option, index) => {
        const optionElement = document.createElement('div');
        optionElement.className = 'option';
        optionElement.textContent = option.text;
        optionElement.addEventListener('click', () => checkAnswer(option.correct, optionElement));
        optionsContainer.appendChild(optionElement);
    });
    
    // Add reference links
    if (randomQuestion.references && randomQuestion.references.length > 0) {
        const linksTitle = document.createElement('p');
        linksTitle.textContent = 'Learn more:';
        referenceLinks.appendChild(linksTitle);
        
        randomQuestion.references.forEach(ref => {
            const link = document.createElement('a');
            link.href = ref.url;
            link.textContent = ref.title || 'Reference';
            link.target = '_blank';
            referenceLinks.appendChild(link);
            referenceLinks.appendChild(document.createElement('br'));
        });
    }
    
    questionModal.classList.remove('hidden');
}

// Check answer
function checkAnswer(isCorrect, optionElement) {
    if (isCorrect) {
        optionElement.classList.add('correct');
        answerFeedback.textContent = 'Correct! +5 points';
        answerFeedback.style.color = 'green';
        updateScore(5);
    } else {
        optionElement.classList.add('wrong');
        answerFeedback.textContent = 'Incorrect! -2 points';
        answerFeedback.style.color = 'red';
        updateScore(-2);
    }
    
    setTimeout(() => {
        questionModal.classList.add('hidden');
    }, 2000);
}

// Reset game
function resetGame() {
    gameBoard.classList.add('hidden');
    startScreen.classList.remove('hidden');
}

// Watch for storage changes
window.addEventListener('storage', (e) => {
    if (e.key === 'examStudyGameData') {
        loadQuestions(gameState.currentTopic);
    }
});

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', initGame);
