# VibeStudy - Quiz/Exam Game Application

VibeStudy is a Python-based web application for creating and taking quizzes/exams across different topics.

## Features
- Multiple question categories (coding, cooking, networking)
- Admin interface to manage questions
- Simple web-based UI

## Requirements
- Python 3.x
- Flask (install via `pip install -r requirements.txt`)

## Running the Application
1. Install dependencies: `pip install -r requirements.txt`
2. Start the server: `python server.py`
3. Open `index.html` in your browser

## Project Structure
- `server.py`: Backend Flask server
- `admin.html`/`admin.js`: Admin interface
- `index.html`/`game.js`: Main game interface
- `questions/`: JSON files containing questions by category
- `styles.css`: Styling for the application
