// Admin functionality for Exam Study Game

// DOM elements
const newTopicInput = document.getElementById('new-topic');
const addTopicBtn = document.getElementById('add-topic');
const topicList = document.getElementById('topic-list');
const importTopicSelect = document.getElementById('import-topic');
const importModeSelect = document.getElementById('import-mode');
const importJsonTextarea = document.getElementById('import-json');
const importBtn = document.getElementById('import-btn');
const validateBtn = document.getElementById('validate-btn');
const jsonTemplate = document.getElementById('json-template');
const copyTemplateBtn = document.getElementById('copy-template');
const backToGameBtn = document.getElementById('back-to-game');
const editTopicSelect = document.getElementById('edit-topic');
const questionEditor = document.getElementById('question-editor');
const categoryList = document.getElementById('category-list');
const saveQuestionsBtn = document.getElementById('save-questions');

let topics = [];

// Initialize admin panel
async function initAdmin() {
    try {
        // Load topics from server
        const response = await fetch('http://localhost:5000/api/topics');
        if (!response.ok) throw new Error('Failed to load topics');
        topics = await response.json();
        
        // Update UI
        updateTopicLists();
        
        // Set JSON template
        jsonTemplate.textContent = JSON.stringify({
            "categories": [{
                "name": "Category Name",
                "questions": [{
                    "question": "Your question here?",
                    "options": [
                        {"text": "Option 1", "correct": false},
                        {"text": "Option 2", "correct": true},
                        {"text": "Option 3", "correct": false}
                    ],
                    "references": [{
                        "title": "Reference Title", 
                        "url": "https://example.com"
                    }]
                }]
            }]
        }, null, 2);
        
        // Update edit topic dropdown
        editTopicSelect.innerHTML = topics.map(topic => 
            `<option value="${topic.id}">${topic.name}</option>`
        ).join('');
        
        // Set up event listeners
        addTopicBtn.addEventListener('click', addNewTopic);
        importBtn.addEventListener('click', importQuestions);
        validateBtn.addEventListener('click', validateJson);
        copyTemplateBtn.addEventListener('click', copyTemplate);
        backToGameBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
        editTopicSelect.addEventListener('change', loadQuestionsForEditing);
        saveQuestionsBtn.addEventListener('click', saveQuestions);
        
        // Grid control buttons
        document.getElementById('add-category').addEventListener('click', addNewCategory);
        document.getElementById('add-question').addEventListener('click', addNewQuestion);
        
        // Event delegation for dynamic grid elements
        document.getElementById('questions-grid').addEventListener('click', (e) => {
            // Handle option additions
            if (e.target.classList.contains('add-option')) {
                const optionsContainer = e.target.parentElement;
                const optionCount = optionsContainer.querySelectorAll('.option-item').length;
                const optionItem = document.createElement('div');
                optionItem.className = 'option-item';
                optionItem.innerHTML = `
                    <input type="text" placeholder="Option ${optionCount + 1}" class="option-input">
                    <input type="radio" name="${e.target.closest('.grid-row').querySelector('input[type="radio"]').name}">
                    <button class="delete-option">×</button>
                `;
                optionsContainer.insertBefore(optionItem, e.target);
            }
            
            // Handle reference additions
            if (e.target.classList.contains('add-reference')) {
                const refContainer = e.target.parentElement;
                const refItem = document.createElement('div');
                refItem.className = 'reference-item';
                refItem.innerHTML = `
                    <input type="text" placeholder="Title" class="reference-title">
                    <input type="url" placeholder="URL" class="reference-url">
                    <button class="delete-reference">×</button>
                `;
                refContainer.insertBefore(refItem, e.target);
            }
            
            // Handle deletions
            if (e.target.classList.contains('delete-option')) {
                e.target.closest('.option-item').remove();
            }
            if (e.target.classList.contains('delete-reference')) {
                e.target.closest('.reference-item').remove();
            }
            if (e.target.classList.contains('delete-question')) {
                if (confirm('Delete this question?')) {
                    e.target.closest('.grid-row').remove();
                }
            }
        });
    } catch (error) {
        console.error('Error initializing admin:', error);
        alert('Failed to initialize admin panel');
    }
}

// Update topic lists in UI
function updateTopicLists() {
    // Update topic list display
    topicList.innerHTML = topics.map(topic => 
        `<div class="topic-item">
            ${topic.name}
            <button class="delete-topic" data-topic="${topic.id}">Delete</button>
        </div>`
    ).join('');
    
    // Update import topic dropdown
    importTopicSelect.innerHTML = topics.map(topic => 
        `<option value="${topic.id}">${topic.name}</option>`
    ).join('');
    
    // Add delete handlers
    document.querySelectorAll('.delete-topic').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const topicId = e.target.dataset.topic;
            if (confirm('Delete this topic and all its questions?')) {
                deleteTopic(topicId);
            }
        });
    });
}

// Add a new topic
async function addNewTopic() {
    const topicName = newTopicInput.value.trim();
    if (!topicName) return;
    
    try {
        const response = await fetch('http://localhost:5000/api/topics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: topicName })
        });
        
        if (!response.ok) throw new Error('Failed to add topic');
        
        const newTopic = await response.json();
        topics.push(newTopic);
        updateTopicLists();
        newTopicInput.value = '';
        alert(`Topic "${topicName}" added successfully!`);
    } catch (error) {
        console.error('Error adding topic:', error);
        alert('Failed to add topic');
    }
}

// Delete a topic
async function deleteTopic(topicId) {
    try {
        const response = await fetch(`http://localhost:5000/api/topics/${topicId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('Failed to delete topic');
        
        topics = topics.filter(t => t.id !== topicId);
        updateTopicLists();
        alert('Topic deleted successfully!');
    } catch (error) {
        console.error('Error deleting topic:', error);
        alert('Failed to delete topic');
    }
}

// Import questions
async function importQuestions() {
    const topicId = importTopicSelect.value;
    const topicName = importTopicSelect.options[importTopicSelect.selectedIndex].text;
    const jsonText = importJsonTextarea.value.trim();
    
    if (!jsonText || !topicId) {
        alert('Please select a topic and enter JSON data');
        return;
    }
    
    try {
        const jsonData = JSON.parse(jsonText);
        const response = await fetch(`http://localhost:5000/api/questions/import/${topicName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: jsonText
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Import failed');
        }
        
        const result = await response.json();
        alert(`Successfully imported ${result.imported} categories with questions!`);
    } catch (error) {
        console.error('Error importing questions:', error);
        alert('Import failed: ' + error.message);
    }
}

// Validate JSON
function validateJson() {
    try {
        JSON.parse(importJsonTextarea.value);
        alert('JSON is valid!');
    } catch (error) {
        alert('Invalid JSON: ' + error.message);
    }
}

// Copy template to clipboard
function copyTemplate() {
    importJsonTextarea.value = jsonTemplate.textContent;
    importJsonTextarea.select();
    document.execCommand('copy');
    alert('Template copied to import area and clipboard!');
}

// Load questions for editing
async function loadQuestionsForEditing() {
    const topicId = editTopicSelect.value;
    const topicName = editTopicSelect.options[editTopicSelect.selectedIndex].text;
    
    if (!topicId) {
        questionEditor.style.display = 'none';
        return;
    }

    try {
        const response = await fetch(`http://localhost:5000/api/questions/for-editing/${topicName}`);
        if (!response.ok) throw new Error('Failed to load questions');
        
        const data = await response.json();
        displayQuestionsForEditing(data);
        questionEditor.style.display = 'block';
    } catch (error) {
        console.error('Error loading questions:', error);
        alert('Failed to load questions: ' + error.message);
    }
}

// Display questions in grid format
function displayQuestionsForEditing(data) {
    questionsGrid.innerHTML = '';
    
    data.categories.forEach(category => {
        category.questions.forEach(question => {
            const row = document.createElement('div');
            row.className = 'grid-row';
            
            row.innerHTML = `
                <div>
                    <input type="text" value="${category.name}" class="category-input">
                </div>
                <div>
                    <textarea class="question-input">${question.question}</textarea>
                </div>
                <div class="question-options">
                    ${question.options.map((option, i) => `
                        <div class="option-item">
                            <input type="text" value="${option.text}" class="option-input">
                            <input type="radio" name="correct-${question.id}" 
                                ${option.correct ? 'checked' : ''}>
                            <button class="delete-option">×</button>
                        </div>
                    `).join('')}
                    <button class="add-option">+ Add Option</button>
                </div>
                <div class="question-references">
                    ${question.references.map(ref => `
                        <div class="reference-item">
                            <input type="text" value="${ref.title || ''}" placeholder="Title">
                            <input type="url" value="${ref.url}" placeholder="URL">
                            <button class="delete-reference">×</button>
                        </div>
                    `).join('')}
                    <button class="add-reference">+ Add Reference</button>
                </div>
                <div class="action-buttons">
                    <button class="save-question">💾</button>
                    <button class="delete-question">🗑️</button>
                </div>
            `;
            
            questionsGrid.appendChild(row);
        });
    });
}

// Save edited questions
async function saveQuestions() {
    const topicName = editTopicSelect.options[editTopicSelect.selectedIndex].text;
    
    // Group questions by category
    const categoriesMap = new Map();
    
    document.querySelectorAll('.grid-row').forEach(row => {
        const category = row.querySelector('.category-input').value;
        const question = row.querySelector('.question-input').value;
        
        if (!question) return; // Skip empty questions
        
        const options = Array.from(row.querySelectorAll('.option-item')).map(opt => ({
            text: opt.querySelector('.option-input').value,
            correct: opt.querySelector('input[type="radio"]').checked
        })).filter(opt => opt.text); // Filter out empty options
        
        const references = Array.from(row.querySelectorAll('.reference-item')).map(ref => ({
            title: ref.querySelector('input[type="text"]').value,
            url: ref.querySelector('input[type="url"]').value
        })).filter(ref => ref.url); // Filter out empty references
        
        if (!categoriesMap.has(category)) {
            categoriesMap.set(category, []);
        }
        
        categoriesMap.get(category).push({
            question,
            options,
            references
        });
    });
    
    // Convert to required format
    const categories = Array.from(categoriesMap.entries()).map(([name, questions]) => ({
        name,
        questions
    }));

    try {
        const response = await fetch(`http://localhost:5000/api/questions/import/${topicName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categories })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Save failed');
        }
        
        const result = await response.json();
        alert(`Successfully saved ${result.imported} categories with questions!`);
    } catch (error) {
        console.error('Error saving questions:', error);
        alert('Save failed: ' + error.message);
    }
}

// Add new category
function addNewCategory() {
    const row = document.createElement('div');
    row.className = 'grid-row';
    row.innerHTML = `
        <div>
            <input type="text" placeholder="New Category" class="category-input">
        </div>
        <div>
            <textarea class="question-input" placeholder="New Question"></textarea>
        </div>
        <div class="question-options">
            <div class="option-item">
                <input type="text" placeholder="Option 1" class="option-input">
                <input type="radio" name="correct-new" checked>
                <button class="delete-option">×</button>
            </div>
            <button class="add-option">+ Add Option</button>
        </div>
        <div class="question-references">
            <button class="add-reference">+ Add Reference</button>
        </div>
        <div class="action-buttons">
            <button class="save-question">💾</button>
            <button class="delete-question">🗑️</button>
        </div>
    `;
    document.getElementById('questions-grid').appendChild(row);
}

// Add new question to existing category
function addNewQuestion() {
    const rows = document.querySelectorAll('.grid-row');
    if (rows.length === 0) return addNewCategory();
    
    const lastCategory = rows[rows.length-1].querySelector('.category-input').value;
    const row = document.createElement('div');
    row.className = 'grid-row';
    row.innerHTML = `
        <div>
            <input type="text" value="${lastCategory}" class="category-input">
        </div>
        <div>
            <textarea class="question-input" placeholder="New Question"></textarea>
        </div>
        <div class="question-options">
            <div class="option-item">
                <input type="text" placeholder="Option 1" class="option-input">
                <input type="radio" name="correct-new" checked>
                <button class="delete-option">×</button>
            </div>
            <button class="add-option">+ Add Option</button>
        </div>
        <div class="question-references">
            <button class="add-reference">+ Add Reference</button>
        </div>
        <div class="action-buttons">
            <button class="save-question">💾</button>
            <button class="delete-question">🗑️</button>
        </div>
    `;
    document.getElementById('questions-grid').appendChild(row);
}

// Initialize admin panel when DOM is loaded
document.addEventListener('DOMContentLoaded', initAdmin);
