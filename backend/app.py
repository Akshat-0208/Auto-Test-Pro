from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from datetime import datetime
import os
from dotenv import load_dotenv
from ui_testing import UITester
from api_testing import APITester
from bson.objectid import ObjectId
from urllib.parse import urlparse
from threading import Thread
import time

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# MongoDB connection
client = MongoClient(os.getenv('MONGODB_URI', 'mongodb+srv://Ak:Aksssh990@cluster0.80egjyv.mongodb.net/'))
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
def api_test():
    data = request.json
    endpoint = data.get('endpoint')
    config = data.get('config', {})
    
    # Create a test ID with ObjectId
    test_id = ObjectId()
    
    # Extract URL parts for test name
    parsed_url = urlparse(endpoint)
    url_parts = parsed_url.netloc + parsed_url.path
    
    # Create initial test record
    test_record = {
        '_id': test_id,
        'testId': str(test_id),
        'type': 'api',
        'url': endpoint,
        'date': datetime.now().isoformat(),
        'status': 'running',
        'method': config.get('method', 'GET'),
        'config': config,
        'endpoint': endpoint,
        'requestType': config.get('method', 'GET')
    }
    
    try:
        # Insert the record
        db.results.insert_one(test_record)
        
        # Start the test process in a background thread
        thread = Thread(target=_run_api_test, args=(str(test_id), endpoint, config))
        thread.daemon = True
        thread.start()
        
        return jsonify({
            'message': 'API test started', 
            'testId': str(test_id)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
        
@app.route('/api/batch-api-test', methods=['POST'])
def batch_api_test():
    data = request.json
    endpoints = data.get('endpoints', [])
    base_config = data.get('config', {})
    
    if not endpoints:
        return jsonify({'error': 'No endpoints provided'}), 400
    
    batch_id = ObjectId()
    test_ids = []
    
    try:
        # Create a batch record
        batch_record = {
            '_id': batch_id,
            'testId': str(batch_id),
            'type': 'api-batch',
            'date': datetime.now().isoformat(),
            'status': 'running',
            'totalEndpoints': len(endpoints),
            'completedEndpoints': 0,
            'endpoints': []
        }
        
        # Insert the batch record
        db.results.insert_one(batch_record)
        
        # Start a test for each endpoint
        for endpoint_info in endpoints:
            endpoint_url = endpoint_info.get('url')
            endpoint_method = endpoint_info.get('method', 'GET')
            endpoint_body = endpoint_info.get('requestBody')
            endpoint_headers = endpoint_info.get('headers', {})
            
            # Create test-specific config by merging with base config
            config = {**base_config}
            config['method'] = endpoint_method
            config['requestBody'] = endpoint_body
            config['headers'] = endpoint_headers
            
            # Create a test ID
            test_id = ObjectId()
            test_ids.append(str(test_id))
            
            # Create initial test record
            test_record = {
                '_id': test_id,
                'testId': str(test_id),
                'batchId': str(batch_id),
                'type': 'api',
                'url': endpoint_url,
                'date': datetime.now().isoformat(),
                'status': 'running',
                'method': endpoint_method,
                'config': config,
                'endpoint': endpoint_url,
                'requestType': endpoint_method
            }
            
            # Add to batch record's endpoints
            batch_record['endpoints'].append({
                'url': endpoint_url,
                'method': endpoint_method,
                'testId': str(test_id)
            })
            
            # Insert the record
            db.results.insert_one(test_record)
            
            # Start the test in a background thread
            thread = Thread(target=_run_api_test, args=(str(test_id), endpoint_url, config, str(batch_id)))
            thread.daemon = True
            thread.start()
        
        # Update the batch record with the list of endpoints
        db.results.update_one(
            {'_id': batch_id},
            {'$set': {'endpoints': batch_record['endpoints']}}
        )
        
        return jsonify({
            'message': f'Batch API test started with {len(endpoints)} endpoints', 
            'batchId': str(batch_id),
            'testIds': test_ids
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
        
def _run_api_test(test_id, endpoint, config, batch_id=None):
    try:
        # Convert string ID to ObjectId
        object_id = ObjectId(test_id)
        
        # Initialize and run the API tester
        tester = APITester(endpoint, config)
        tester.run_tests(object_id)
        
        # Update batch record if this is part of a batch
        if batch_id:
            db.results.update_one(
                {'_id': ObjectId(batch_id)},
                {'$inc': {'completedEndpoints': 1}}
            )
            
            # Check if all endpoints in this batch are completed
            batch_record = db.results.find_one({'_id': ObjectId(batch_id)})
            if batch_record and batch_record.get('completedEndpoints') >= batch_record.get('totalEndpoints'):
                db.results.update_one(
                    {'_id': ObjectId(batch_id)},
                    {'$set': {'status': 'completed'}}
                )
    except Exception as e:
        # Update test record with error status in case of failure
        db.results.update_one(
            {'_id': object_id},
            {'$set': {'status': 'failed', 'error': str(e)}}
        )
        
        # Update batch record if this is part of a batch
        if batch_id:
            db.results.update_one(
                {'_id': ObjectId(batch_id)},
                {'$inc': {'completedEndpoints': 1}}
            )

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

# Add a new endpoint to save and manage environments
@app.route('/api/environments', methods=['GET'])
def get_environments():
    try:
        # Fetch environments without projection
        environments = list(db.environments.find())
        
        # Manually convert ObjectId to string for each document
        for env in environments:
            env['id'] = str(env['_id'])
            env.pop('_id')
            
        return jsonify(environments)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/environments', methods=['POST'])
def create_environment():
    try:
        data = request.json
        if not data.get('name') or not data.get('baseUrl'):
            return jsonify({'error': 'Environment name and base URL are required'}), 400
            
        # Create environment record
        environment = {
            'name': data['name'],
            'baseUrl': data['baseUrl'],
            'endpoints': data.get('endpoints', []),
            'createdAt': datetime.utcnow()
        }
        
        result = db.environments.insert_one(environment)
        
        return jsonify({
            'message': 'Environment created successfully',
            'environmentId': str(result.inserted_id)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/environments/<environment_id>', methods=['PUT'])
def update_environment(environment_id):
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        # Convert string ID to ObjectId
        try:
            object_id = ObjectId(environment_id)
        except:
            return jsonify({'error': 'Invalid environment ID format'}), 400
        
        # Update environment
        result = db.environments.update_one(
            {'_id': object_id},
            {'$set': data}
        )
        
        if result.matched_count == 0:
            return jsonify({'error': 'Environment not found'}), 404
            
        return jsonify({'message': 'Environment updated successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
        
@app.route('/api/environments/<environment_id>', methods=['DELETE'])
def delete_environment(environment_id):
    try:
        # Convert string ID to ObjectId
        try:
            object_id = ObjectId(environment_id)
        except:
            return jsonify({'error': 'Invalid environment ID format'}), 400
        
        # Delete environment
        result = db.environments.delete_one({'_id': object_id})
        
        if result.deleted_count == 0:
            return jsonify({'error': 'Environment not found'}), 404
            
        return jsonify({'message': 'Environment deleted successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/unified-api-test', methods=['POST'])
def unified_api_test():
    data = request.json
    endpoints = data.get('endpoints', [])
    base_config = data.get('config', {})
    
    if not endpoints:
        return jsonify({'error': 'No endpoints provided'}), 400
    
    # Create a test ID with ObjectId
    test_id = ObjectId()
    
    # Group endpoints by type
    get_endpoints = []
    post_endpoints = []
    put_endpoints = []
    patch_endpoints = []
    delete_endpoints = []
    
    for endpoint_info in endpoints:
        endpoint_url = endpoint_info.get('url')
        endpoint_method = endpoint_info.get('method', 'GET').upper()
        
        if endpoint_method == 'GET':
            get_endpoints.append(endpoint_info)
        elif endpoint_method == 'POST':
            post_endpoints.append(endpoint_info)
        elif endpoint_method == 'PUT':
            put_endpoints.append(endpoint_info)
        elif endpoint_method == 'PATCH':
            patch_endpoints.append(endpoint_info)
        elif endpoint_method == 'DELETE':
            delete_endpoints.append(endpoint_info)
    
    # Create initial test record
    test_record = {
        '_id': test_id,
        'testId': str(test_id),
        'type': 'api',
        'name': 'Unified API Test',
        'url': 'Multiple Endpoints',
        'date': datetime.now().isoformat(),
        'status': 'running',
        'config': base_config,
        'endpointGroups': {
            'GET': len(get_endpoints),
            'POST': len(post_endpoints),
            'PUT': len(put_endpoints),
            'PATCH': len(patch_endpoints),
            'DELETE': len(delete_endpoints)
        },
        'totalEndpoints': len(endpoints),
        'endpointDetails': endpoints
    }
    
    try:
        # Insert the record
        db.results.insert_one(test_record)
        
        # Start the test process in a background thread
        thread = Thread(target=_run_unified_api_test, args=(str(test_id), endpoints, base_config))
        thread.daemon = True
        thread.start()
        
        return jsonify({
            'message': 'Unified API test started', 
            'testId': str(test_id)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def _run_unified_api_test(test_id, endpoints, base_config):
    """Run tests for multiple endpoints and combine results into a single test"""
    try:
        object_id = ObjectId(test_id)
        start_time = time.time()
        all_test_results = []
        total_tests_run = 0
        passed_tests = 0
        
        print(f"Starting unified test {test_id} with {len(endpoints)} endpoints")
        
        # First update to show that processing has started
        db.results.update_one(
            {'_id': object_id},
            {'$set': {'processingStarted': True}}
        )
        
        # Test each endpoint
        for i, endpoint_info in enumerate(endpoints):
            endpoint_url = endpoint_info.get('url')
            endpoint_method = endpoint_info.get('method', 'GET')
            endpoint_body = endpoint_info.get('requestBody')
            endpoint_headers = endpoint_info.get('headers', {})
            endpoint_name = endpoint_info.get('name', 'Unnamed Endpoint')
            
            print(f"Testing endpoint {i+1}/{len(endpoints)}: {endpoint_name} ({endpoint_method} {endpoint_url})")
            
            # Create test-specific config by merging with base config
            config = {**base_config}
            config['method'] = endpoint_method
            config['requestBody'] = endpoint_body
            config['headers'] = endpoint_headers
            
            # Run the tests
            tester = APITester(endpoint_url, config)
            # Call a new method that returns results instead of updating DB
            endpoint_results, endpoint_stats = tester.run_tests_collect_results()
            
            print(f"Endpoint {endpoint_name} completed with {endpoint_stats.get('total_tests', 0)} tests, {endpoint_stats.get('passed_tests', 0)} passed")
            
            # Process the results - add endpoint information
            for result in endpoint_results:
                result['endpointName'] = endpoint_name
                result['method'] = endpoint_method
            
            # Add to combined results
            all_test_results.extend(endpoint_results)
            total_tests_run += endpoint_stats.get('total_tests', 0)
            passed_tests += endpoint_stats.get('passed_tests', 0)
            
            # Update progress
            db.results.update_one(
                {'_id': object_id},
                {'$set': {'completedEndpoints': i+1, 'totalEndpoints': len(endpoints)}}
            )
        
        # Calculate overall stats
        duration = time.time() - start_time
        pass_rate = (passed_tests / total_tests_run * 100) if total_tests_run > 0 else 0
        
        print(f"Unified test {test_id} completed. Total tests: {total_tests_run}, Passed: {passed_tests}, Pass rate: {pass_rate:.1f}%, Duration: {duration:.2f}s")
        
        # Sort results by method and then by endpoint
        all_test_results.sort(key=lambda x: (
            tester._get_method_order(x.get('requestType', x.get('method', 'GET'))), 
            x.get('endpointName', ''),
            x.get('type', '')
        ))
        
        # Update the test result in DB - use multiple attempts to ensure it completes
        success = False
        max_attempts = 3
        
        for attempt in range(max_attempts):
            try:
                update_result = db.results.update_one(
                    {'_id': object_id},
                    {
                        '$set': {
                            'status': 'completed',
                            'testsRun': total_tests_run,
                            'passRate': pass_rate,
                            'duration': duration,
                            'testResults': all_test_results,
                            'completedAt': datetime.now().isoformat()
                        }
                    }
                )
                
                print(f"Database update attempt {attempt+1}: matched={update_result.matched_count}, modified={update_result.modified_count}")
                
                # Verify the update
                result = db.results.find_one({'_id': object_id})
                current_status = result.get('status', 'unknown')
                print(f"Verification - Test status is now: {current_status}")
                
                if current_status == 'completed':
                    success = True
                    break
                
                # If the status didn't update correctly, wait and try again
                if attempt < max_attempts - 1:
                    print(f"Status not updated correctly, waiting before retry...")
                    time.sleep(1)  # Wait 1 second before retrying
                    
            except Exception as db_error:
                print(f"Error updating database (attempt {attempt+1}): {str(db_error)}")
                if attempt < max_attempts - 1:
                    time.sleep(1)  # Wait before retrying
        
        if not success:
            print(f"WARNING: Failed to update test status after {max_attempts} attempts")
            
    except Exception as e:
        print(f"Error in unified test: {str(e)}")
        # Update test record with error status
        try:
            db.results.update_one(
                {'_id': object_id},
                {'$set': {'status': 'failed', 'error': str(e), 'completedAt': datetime.now().isoformat()}}
            )
            print(f"Updated test status to 'failed' due to error")
        except Exception as update_error:
            print(f"Error updating failure status: {str(update_error)}")
            # At this point we've done all we can to report the error

if __name__ == '__main__':
    app.run(debug=True) 