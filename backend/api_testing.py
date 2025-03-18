import requests
import time
from pymongo import MongoClient
import os
from dotenv import load_dotenv
import json
from urllib.parse import urlparse, parse_qs

load_dotenv()

class APITester:
    def __init__(self, endpoint, config):
        self.endpoint = endpoint
        self.config = config
        self.client = MongoClient(os.getenv('MONGODB_URI', 'mongodb://localhost:27017/'))
        self.db = self.client.autotester
        self.results_collection = self.db.results
        self.test_results = []

    def run_tests(self, result_id):
        try:
            start_time = time.time()
            self._test_endpoint()
            
            # Calculate test statistics
            total_tests = len(self.test_results)
            passed_tests = sum(1 for result in self.test_results if result['status'] == 'passed')
            pass_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
            duration = time.time() - start_time

            # Update test result in database
            self.results_collection.update_one(
                {'_id': result_id},
                {
                    '$set': {
                        'status': 'completed',
                        'testsRun': total_tests,
                        'passRate': pass_rate,
                        'duration': duration,
                        'testResults': self.test_results
                    }
                }
            )
        except Exception as e:
            self.results_collection.update_one(
                {'_id': result_id},
                {
                    '$set': {
                        'status': 'failed',
                        'error': str(e)
                    }
                }
            )

    def _test_endpoint(self):
        # Test basic endpoint functionality
        self._test_basic_request()

        # Test query parameters if enabled
        if self.config.get('testParameters', True):
            self._test_query_parameters()

        # Test headers if enabled
        if self.config.get('testHeaders', True):
            self._test_headers()

        # Test response time if enabled
        if self.config.get('testResponseTime', True):
            self._test_response_time()

        # Test error cases if enabled
        if self.config.get('testErrorCases', True):
            self._test_error_cases()

    def _test_basic_request(self):
        try:
            start_time = time.time()
            response = requests.request(
                method=self.config.get('method', 'GET'),
                url=self.endpoint,
                timeout=10
            )
            duration = time.time() - start_time

            self.test_results.append({
                'type': 'basic_request',
                'method': self.config.get('method', 'GET'),
                'status': 'passed' if response.status_code < 400 else 'failed',
                'statusCode': response.status_code,
                'duration': duration,
                'responseSize': len(response.content)
            })
        except Exception as e:
            self.test_results.append({
                'type': 'basic_request',
                'method': self.config.get('method', 'GET'),
                'status': 'failed',
                'error': str(e)
            })

    def _test_query_parameters(self):
        parsed_url = urlparse(self.endpoint)
        query_params = parse_qs(parsed_url.query)

        # Test with different parameter combinations
        test_params = {
            'valid': {'page': '1', 'limit': '10'},
            'invalid': {'page': 'invalid', 'limit': '-1'},
            'empty': {'page': '', 'limit': ''}
        }

        for param_type, params in test_params.items():
            try:
                start_time = time.time()
                response = requests.request(
                    method=self.config.get('method', 'GET'),
                    url=self.endpoint,
                    params=params,
                    timeout=10
                )
                duration = time.time() - start_time

                self.test_results.append({
                    'type': 'query_parameters',
                    'parameters': params,
                    'status': 'passed' if response.status_code < 400 else 'failed',
                    'statusCode': response.status_code,
                    'duration': duration
                })
            except Exception as e:
                self.test_results.append({
                    'type': 'query_parameters',
                    'parameters': params,
                    'status': 'failed',
                    'error': str(e)
                })

    def _test_headers(self):
        test_headers = [
            {'Accept': 'application/json'},
            {'Accept': 'application/xml'},
            {'Content-Type': 'application/json'},
            {'Authorization': 'Bearer test-token'}
        ]

        for headers in test_headers:
            try:
                start_time = time.time()
                response = requests.request(
                    method=self.config.get('method', 'GET'),
                    url=self.endpoint,
                    headers=headers,
                    timeout=10
                )
                duration = time.time() - start_time

                self.test_results.append({
                    'type': 'headers',
                    'headers': headers,
                    'status': 'passed' if response.status_code < 400 else 'failed',
                    'statusCode': response.status_code,
                    'duration': duration
                })
            except Exception as e:
                self.test_results.append({
                    'type': 'headers',
                    'headers': headers,
                    'status': 'failed',
                    'error': str(e)
                })

    def _test_response_time(self):
        response_times = []
        for _ in range(5):  # Test 5 times
            try:
                start_time = time.time()
                response = requests.request(
                    method=self.config.get('method', 'GET'),
                    url=self.endpoint,
                    timeout=10
                )
                duration = time.time() - start_time
                response_times.append(duration)
            except Exception as e:
                self.test_results.append({
                    'type': 'response_time',
                    'status': 'failed',
                    'error': str(e)
                })
                break

        if response_times:
            avg_time = sum(response_times) / len(response_times)
            self.test_results.append({
                'type': 'response_time',
                'status': 'passed',
                'averageTime': avg_time,
                'minTime': min(response_times),
                'maxTime': max(response_times)
            })

    def _test_error_cases(self):
        error_cases = [
            {'url': 'invalid-url'},
            {'method': 'INVALID_METHOD'},
            {'timeout': 0.001},  # Very short timeout
            {'data': json.dumps({'invalid': 'json'})}
        ]

        for case in error_cases:
            try:
                start_time = time.time()
                response = requests.request(
                    method=self.config.get('method', 'GET'),
                    url=self.endpoint,
                    **case,
                    timeout=10
                )
                duration = time.time() - start_time

                self.test_results.append({
                    'type': 'error_case',
                    'case': case,
                    'status': 'passed' if response.status_code >= 400 else 'failed',
                    'statusCode': response.status_code,
                    'duration': duration
                })
            except Exception as e:
                self.test_results.append({
                    'type': 'error_case',
                    'case': case,
                    'status': 'passed',  # Expected to fail
                    'error': str(e)
                }) 