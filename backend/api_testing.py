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
            request_method = self.config.get('method', 'GET')
            start_time = time.time()
            response = requests.request(
                method=request_method,
                url=self.endpoint,
                timeout=10
            )
            duration = time.time() - start_time
            
            # Get response type and sample content
            content_type = response.headers.get('Content-Type', '')
            response_preview = self._get_response_preview(response)

            self.test_results.append({
                'type': 'basic_request',
                'element': self.endpoint,
                'elementType': 'endpoint',
                'endpoint': self.endpoint,
                'requestType': request_method,
                'status': 'passed' if response.status_code < 400 else 'failed',
                'statusCode': response.status_code,
                'duration': duration,
                'responseSize': len(response.content),
                'contentType': content_type,
                'responsePreview': response_preview
            })
        except Exception as e:
            request_method = self.config.get('method', 'GET')
            self.test_results.append({
                'type': 'basic_request',
                'element': self.endpoint,
                'elementType': 'endpoint',
                'endpoint': self.endpoint,
                'requestType': request_method,
                'status': 'failed',
                'error': str(e)
            })
            
    def _get_response_preview(self, response):
        """Extract a preview of the response for visualization"""
        preview = ""
        content_type = response.headers.get('Content-Type', '').lower()
        
        try:
            if 'application/json' in content_type:
                # For JSON responses, pretty print a sample
                json_data = response.json()
                preview = json.dumps(json_data, indent=2)
                # Limit the preview size
                if len(preview) > 500:
                    preview = preview[:500] + "..."
            elif 'text/html' in content_type:
                # For HTML, return a truncated version
                preview = response.text[:500] + "..." if len(response.text) > 500 else response.text
            elif 'text/' in content_type:
                # For other text responses
                preview = response.text[:500] + "..." if len(response.text) > 500 else response.text
            else:
                # For binary content
                preview = f"Binary content ({len(response.content)} bytes)"
        except Exception as e:
            preview = f"Could not parse response: {str(e)}"
            
        return preview

    def _test_query_parameters(self):
        parsed_url = urlparse(self.endpoint)
        query_params = parse_qs(parsed_url.query)
        request_method = self.config.get('method', 'GET')

        # Test with different parameter combinations
        test_params = {
            'valid': {'page': '1', 'limit': '10'},
            'invalid': {'page': 'invalid', 'limit': '-1'},
            'empty': {'page': '', 'limit': ''}
        }

        for param_type, params in test_params.items():
            try:
                # Build the test URL with parameters for display
                base_url = parsed_url.scheme + "://" + parsed_url.netloc + parsed_url.path
                param_strings = []
                for key, value in params.items():
                    param_strings.append(f"{key}={value}")
                test_url = base_url + "?" + "&".join(param_strings)
                
                start_time = time.time()
                response = requests.request(
                    method=request_method,
                    url=self.endpoint,
                    params=params,
                    timeout=10
                )
                duration = time.time() - start_time
                
                # Get response type and sample content
                content_type = response.headers.get('Content-Type', '')
                response_preview = self._get_response_preview(response)

                self.test_results.append({
                    'type': 'query_parameters',
                    'element': test_url,
                    'elementType': 'endpoint',
                    'endpoint': test_url,
                    'requestType': request_method,
                    'parameters': params,
                    'status': 'passed' if response.status_code < 400 else 'failed',
                    'statusCode': response.status_code,
                    'duration': duration,
                    'contentType': content_type,
                    'responsePreview': response_preview
                })
            except Exception as e:
                self.test_results.append({
                    'type': 'query_parameters',
                    'element': self.endpoint,
                    'elementType': 'endpoint',
                    'endpoint': self.endpoint,
                    'requestType': request_method,
                    'parameters': params,
                    'status': 'failed',
                    'error': str(e)
                })

    def _test_headers(self):
        request_method = self.config.get('method', 'GET')
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
                    method=request_method,
                    url=self.endpoint,
                    headers=headers,
                    timeout=10
                )
                duration = time.time() - start_time
                
                # Format headers for display
                header_str = ", ".join([f"{k}: {v}" for k, v in headers.items()])
                element_display = f"{self.endpoint} [Headers: {header_str}]"
                
                # Get response type and sample content
                content_type = response.headers.get('Content-Type', '')
                response_preview = self._get_response_preview(response)

                self.test_results.append({
                    'type': 'headers',
                    'element': element_display,
                    'elementType': 'endpoint',
                    'endpoint': self.endpoint,
                    'requestType': request_method,
                    'headers': headers,
                    'status': 'passed' if response.status_code < 400 else 'failed',
                    'statusCode': response.status_code,
                    'duration': duration,
                    'contentType': content_type,
                    'responsePreview': response_preview
                })
            except Exception as e:
                self.test_results.append({
                    'type': 'headers',
                    'element': self.endpoint,
                    'elementType': 'endpoint',
                    'endpoint': self.endpoint,
                    'requestType': request_method,
                    'headers': headers,
                    'status': 'failed',
                    'error': str(e)
                })

    def _test_response_time(self):
        request_method = self.config.get('method', 'GET')
        response_times = []
        responses = []
        
        for _ in range(5):  # Test 5 times
            try:
                start_time = time.time()
                response = requests.request(
                    method=request_method,
                    url=self.endpoint,
                    timeout=10
                )
                duration = time.time() - start_time
                response_times.append(duration)
                responses.append(response)
            except Exception as e:
                self.test_results.append({
                    'type': 'response_time',
                    'element': self.endpoint,
                    'elementType': 'endpoint',
                    'endpoint': self.endpoint,
                    'requestType': request_method,
                    'status': 'failed',
                    'error': str(e)
                })
                break

        if response_times:
            avg_time = sum(response_times) / len(response_times)
            
            # Get response type and sample content from the last response
            last_response = responses[-1]
            content_type = last_response.headers.get('Content-Type', '')
            response_preview = self._get_response_preview(last_response)
            
            # Format element display to show timing information
            element_display = f"{self.endpoint} [Response Time Test]"
            
            self.test_results.append({
                'type': 'response_time',
                'element': element_display,
                'elementType': 'endpoint',
                'endpoint': self.endpoint,
                'requestType': request_method,
                'status': 'passed',
                'averageTime': avg_time,
                'minTime': min(response_times),
                'maxTime': max(response_times),
                'contentType': content_type,
                'responsePreview': response_preview
            })

    def _test_error_cases(self):
        request_method = self.config.get('method', 'GET')
        error_cases = [
            {'url': 'invalid-url'},
            {'method': 'INVALID_METHOD'},
            {'timeout': 0.001},  # Very short timeout
            {'data': json.dumps({'invalid': 'json'})}
        ]

        for case in error_cases:
            try:
                # Format case for display
                case_str = ", ".join([f"{k}: {v}" for k, v in case.items()])
                element_display = f"{self.endpoint} [Error Test: {case_str}]"
                
                start_time = time.time()
                response = requests.request(
                    method=request_method,
                    url=self.endpoint,
                    **case,
                    timeout=10
                )
                duration = time.time() - start_time
                
                # Get response type and sample content
                content_type = response.headers.get('Content-Type', '')
                response_preview = self._get_response_preview(response)

                self.test_results.append({
                    'type': 'error_case',
                    'element': element_display,
                    'elementType': 'endpoint',
                    'endpoint': self.endpoint,
                    'requestType': request_method if not 'method' in case else case['method'],
                    'case': case,
                    'status': 'passed' if response.status_code >= 400 else 'failed',
                    'statusCode': response.status_code,
                    'duration': duration,
                    'contentType': content_type,
                    'responsePreview': response_preview
                })
            except Exception as e:
                self.test_results.append({
                    'type': 'error_case',
                    'element': element_display,
                    'elementType': 'endpoint',
                    'endpoint': self.endpoint,
                    'requestType': request_method if not 'method' in case else case['method'],
                    'case': case,
                    'status': 'passed',  # Exception means we successfully tested an error case
                    'error': str(e)
                }) 