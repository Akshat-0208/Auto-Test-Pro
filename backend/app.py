from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from datetime import datetime
import os
from dotenv import load_dotenv
from ui_testing import UITester
from api_testing import APITester
from bson.objectid import ObjectId

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# MongoDB connection
client = MongoClient(os.getenv('MONGODB_URI', 'mongodb://localhost:27017/'))
db = client.autotester
results_collection = db.results

@app.route('/api/ui-test', methods=['POST'])
def start_ui_test():
    try:
        data = request.json
        url = data.get('url')
        config = data.get('config', {})

        if not url:
            return jsonify({'error': 'URL is required'}), 400

        # Create a new test result document
        test_result = {
            'type': 'ui',
            'url': url,
            'status': 'running',
            'date': datetime.utcnow(),
            'config': config,
            'testsRun': 0,
            'passRate': 0,
            'duration': 0
        }
        result_id = results_collection.insert_one(test_result).inserted_id

        # Start UI testing in background
        tester = UITester(url, config)
        tester.run_tests(result_id)

        return jsonify({
            'message': 'UI test started successfully',
            'testId': str(result_id)
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/api-test', methods=['POST'])
def start_api_test():
    try:
        data = request.json
        endpoint = data.get('endpoint')
        config = data.get('config', {})

        if not endpoint:
            return jsonify({'error': 'Endpoint is required'}), 400

        # Create a new test result document
        test_result = {
            'type': 'api',
            'url': endpoint,
            'status': 'running',
            'date': datetime.utcnow(),
            'config': config,
            'testsRun': 0,
            'passRate': 0,
            'duration': 0
        }
        result_id = results_collection.insert_one(test_result).inserted_id

        # Start API testing in background
        tester = APITester(endpoint, config)
        tester.run_tests(result_id)

        return jsonify({
            'message': 'API test started successfully',
            'testId': str(result_id)
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/results', methods=['GET'])
def get_results():
    try:
        # Modify to add testId based on the _id
        results = list(results_collection.find())
        # Convert ObjectId to string and add as testId
        for result in results:
            result['testId'] = str(result['_id'])
            del result['_id']  # Still remove _id to avoid serialization issues
        return jsonify(results)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/results/<test_id>', methods=['GET'])
def get_test_result(test_id):
    try:
        result = results_collection.find_one({'_id': test_id}, {'_id': 0})
        if not result:
            return jsonify({'error': 'Test result not found'}), 404
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/results/<test_id>', methods=['DELETE'])
def delete_test_result(test_id):
    try:
        # Try to convert the test_id to ObjectId
        try:
            object_id = ObjectId(test_id)
            result = results_collection.delete_one({'_id': object_id})
        except:
            # If test_id is not a valid ObjectId, try to delete by testId
            result = results_collection.delete_one({'testId': test_id})
            
        if result.deleted_count == 0:
            return jsonify({'error': 'Test result not found'}), 404
            
        return jsonify({'message': 'Test result deleted successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True) 