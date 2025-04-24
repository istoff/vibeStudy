from flask import Flask, jsonify, request, send_from_directory
import sqlite3
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

DATABASE = 'exam_game.db'

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with app.app_context():
        db = get_db()
        db.execute('''
            CREATE TABLE IF NOT EXISTS topics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL
            )
        ''')
        db.execute('''
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                topic_id INTEGER,
                name TEXT NOT NULL,
                FOREIGN KEY(topic_id) REFERENCES topics(id)
            )
        ''')
        db.execute('''
            CREATE TABLE IF NOT EXISTS questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category_id INTEGER,
                question TEXT NOT NULL,
                FOREIGN KEY(category_id) REFERENCES categories(id)
            )
        ''')
        db.execute('''
            CREATE TABLE IF NOT EXISTS options (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                question_id INTEGER,
                text TEXT NOT NULL,
                is_correct BOOLEAN NOT NULL DEFAULT 0,
                FOREIGN KEY(question_id) REFERENCES questions(id)
            )
        ''')
        db.execute('''
            CREATE TABLE IF NOT EXISTS question_references (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                question_id INTEGER,
                title TEXT,
                url TEXT NOT NULL,
                FOREIGN KEY(question_id) REFERENCES questions(id)
            )
        ''')
        db.execute('''
            CREATE TABLE IF NOT EXISTS game_state (
                id INTEGER PRIMARY KEY,
                current_topic TEXT,
                current_position INTEGER,
                current_score INTEGER,
                target_score INTEGER
            )
        ''')
        db.commit()

@app.route('/api/topics', methods=['GET', 'POST'])
def handle_topics():
    db = get_db()
    if request.method == 'POST':
        data = request.json
        try:
            result = db.execute(
                'INSERT INTO topics (name) VALUES (?)',
                (data['name'],)
            )
            db.commit()
            return jsonify({'id': result.lastrowid, 'name': data['name']}), 201
        except sqlite3.IntegrityError:
            return jsonify({'error': 'Topic already exists'}), 400
    else:
        topics = db.execute('SELECT * FROM topics').fetchall()
        return jsonify([dict(topic) for topic in topics])

@app.route('/api/questions/import/<topic>', methods=['POST'])
def import_questions(topic):
    db = get_db()
    data = request.json
    
    # Verify topic exists
    topic_row = db.execute('SELECT id FROM topics WHERE name = ?', (topic,)).fetchone()
    if not topic_row:
        return jsonify({'error': 'Topic not found'}), 404
    
    try:
        for category in data['categories']:
            # Insert category
            cat_result = db.execute(
                'INSERT INTO categories (topic_id, name) VALUES (?, ?)',
                (topic_row['id'], category['name'])
            )
            category_id = cat_result.lastrowid
            
            for question in category['questions']:
                # Insert question
                q_result = db.execute(
                    'INSERT INTO questions (category_id, question) VALUES (?, ?)',
                    (category_id, question['question'])
                )
                question_id = q_result.lastrowid
                
                # Insert options
                for option in question['options']:
                    db.execute(
                        'INSERT INTO options (question_id, text, is_correct) VALUES (?, ?, ?)',
                        (question_id, option['text'], option['correct'])
                    )
                
                # Insert references
                for ref in question.get('references', []):
                    db.execute(
                        'INSERT INTO question_references (question_id, title, url) VALUES (?, ?, ?)',
                        (question_id, ref.get('title'), ref['url'])
                    )
        
        db.commit()
        return jsonify({'status': 'success', 'imported': len(data['categories'])}), 201
    
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 400

@app.route('/api/questions/for-editing/<topic>', methods=['GET'])
def get_questions_for_editing(topic):
    db = get_db()
    # Get full hierarchical structure for editing
    topics = db.execute('''
        SELECT t.id as topic_id, t.name as topic_name,
               c.id as category_id, c.name as category_name,
               q.id as question_id, q.question,
               o.id as option_id, o.text as option_text, o.is_correct,
               r.id as reference_id, r.title as reference_title, r.url
        FROM topics t
        LEFT JOIN categories c ON c.topic_id = t.id
        LEFT JOIN questions q ON q.category_id = c.id
        LEFT JOIN options o ON o.question_id = q.id
        LEFT JOIN question_references r ON r.question_id = q.id
        WHERE t.name = ?
        ORDER BY c.name, q.id, o.id
    ''', (topic,)).fetchall()
    
    # Structure the data hierarchically
    result = {
        'topic': {'id': None, 'name': topic},
        'categories': []
    }
    
    current_category = None
    current_question = None
    
    for row in topics:
        if not result['topic']['id']:
            result['topic']['id'] = row['topic_id']
        
        # Add category if new
        if not current_category or current_category['id'] != row['category_id']:
            if current_category:
                result['categories'].append(current_category)
            current_category = {
                'id': row['category_id'],
                'name': row['category_name'],
                'questions': []
            }
        
        # Add question if new (and if category exists)
        if row['question_id'] and (not current_question or current_question['id'] != row['question_id']):
            if current_category:
                current_question = {
                    'id': row['question_id'],
                    'question': row['question'],
                    'options': [],
                    'references': []
                }
                current_category['questions'].append(current_question)
        
        # Add option if exists
        if row['option_id'] and current_question:
            current_question['options'].append({
                'id': row['option_id'],
                'text': row['option_text'],
                'correct': bool(row['is_correct'])
            })
        
        # Add reference if exists
        if row['reference_id'] and current_question:
            current_question['references'].append({
                'id': row['reference_id'],
                'title': row['reference_title'],
                'url': row['url']
            })
    
    if current_category:
        result['categories'].append(current_category)
    
    return jsonify(result)

@app.route('/api/questions/<topic>', methods=['GET'])
def get_questions(topic):
    db = get_db()
    questions = db.execute('''
        SELECT q.id, q.question, c.name as category, 
               json_group_array(json_object('text', o.text, 'correct', o.is_correct)) as options,
               json_group_array(json_object('title', r.title, 'url', r.url)) as "references"
        FROM questions q
        JOIN categories c ON q.category_id = c.id
        JOIN topics t ON c.topic_id = t.id
        LEFT JOIN options o ON o.question_id = q.id
        LEFT JOIN question_references r ON r.question_id = q.id
        WHERE t.name = ?
        GROUP BY q.id
    ''', (topic,)).fetchall()
    
    return jsonify([dict(q) for q in questions])

@app.route('/api/game/state', methods=['GET', 'POST'])
def game_state():
    db = get_db()
    if request.method == 'POST':
        data = request.json
        db.execute('''
            INSERT OR REPLACE INTO game_state 
            (id, current_topic, current_position, current_score, target_score)
            VALUES (1, ?, ?, ?, ?)
        ''', (data['current_topic'], data['current_position'], 
             data['current_score'], data['target_score']))
        db.commit()
        return jsonify({'status': 'success'})
    else:
        state = db.execute('SELECT * FROM game_state WHERE id = 1').fetchone()
        return jsonify(dict(state) if state else {})

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/admin.html')
def serve_admin():
    return send_from_directory('.', 'admin.html')

@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory('.', filename)

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)
