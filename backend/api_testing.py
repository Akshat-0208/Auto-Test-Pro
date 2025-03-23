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
        
        # Extract request specific data
        self.method = config.get('method', 'GET')
        self.request_body = config.get('requestBody')
        self.headers = config.get('headers', {})
        self.max_requests = config.get('maxRequests', 50)
        
        # Convert request body from string to JSON if needed
        if isinstance(self.request_body, str) and self.request_body.strip():
            try:
                self.request_body = json.loads(self.request_body)
            except:
                # Keep as string if not valid JSON
                pass

    def run_tests(self, result_id):
        try:
            start_time = time.time()
            self._test_endpoint()
            
            # Calculate test statistics
            total_tests = len(self.test_results)
            passed_tests = sum(1 for result in self.test_results if result['status'] == 'passed')
            pass_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
            duration = time.time() - start_time

            # Organize test results by request method for better Excel export
            organized_results = []
            for result in self.test_results:
                # Add method_order field to help with sorting by request method
                method_order = self._get_method_order(result.get('requestType', self.method))
                result['method_order'] = method_order
                organized_results.append(result)
            
            # Sort results by method order (GET, POST, PUT, etc.) and then by type
            organized_results.sort(key=lambda x: (x.get('method_order', 99), x.get('type', '')))

            # Update test result in database
            self.results_collection.update_one(
                {'_id': result_id},
                {
                    '$set': {
                        'status': 'completed',
                        'testsRun': total_tests,
                        'passRate': pass_rate,
                        'duration': duration,
                        'testResults': organized_results
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

    def run_tests_collect_results(self):
        """Run tests and return results without updating the database."""
        try:
            # Reset test results in case this is called multiple times
            self.test_results = []
            
            # Run all tests
            self._test_endpoint()
            
            # Calculate test statistics
            total_tests = len(self.test_results)
            passed_tests = sum(1 for result in self.test_results if result['status'] == 'passed')
            
            # Organize test results by request method for better Excel export
            organized_results = []
            for result in self.test_results:
                # Add method_order field to help with sorting by request method
                method_order = self._get_method_order(result.get('requestType', self.method))
                result['method_order'] = method_order
                organized_results.append(result)
            
            # Sort results by method order (GET, POST, PUT, etc.) and then by type
            organized_results.sort(key=lambda x: (x.get('method_order', 99), x.get('type', '')))
            
            # Return results and stats
            stats = {
                'total_tests': total_tests,
                'passed_tests': passed_tests
            }
            
            return organized_results, stats
        except Exception as e:
            # If there's an error, return it with empty results
            return [], {'total_tests': 0, 'passed_tests': 0, 'error': str(e)}

    def _get_method_order(self, method):
        """Helper method to get sort order for HTTP methods"""
        method_orders = {
            'GET': 1,
            'POST': 2, 
            'PUT': 3,
            'PATCH': 4,
            'DELETE': 5
        }
        return method_orders.get(method.upper(), 99)

    def _test_endpoint(self):
        # Determine which tests to run based on HTTP method
        # Test basic endpoint functionality for all methods
        self._test_basic_request()
        
        # Track how many requests we've made to respect max_requests limit
        request_count = 1  # Already made one in _test_basic_request
        
        # For GET requests: focus on query params, headers, and response time
        if self.method == 'GET':
            # Test query parameters if enabled
            if self.config.get('testParams', True) and request_count < self.max_requests:
                test_count = self._test_query_parameters()
                request_count += test_count
            
            # Test headers if enabled
            if self.config.get('testHeaders', True) and request_count < self.max_requests:
                test_count = self._test_headers()
                request_count += test_count
                
            # Test response time if enabled
            if self.config.get('testResponseTime', True) and request_count < self.max_requests:
                test_count = min(5, self.max_requests - request_count)  # Up to 5 requests
                self._test_response_time(test_count)
                request_count += test_count
                
            # Test error cases if enabled
            if self.config.get('testErrorCases', True) and request_count < self.max_requests:
                test_count = min(len(self._get_error_cases()), self.max_requests - request_count)
                self._test_error_cases(test_count)
        
        # For POST/PUT/PATCH requests: focus on request body, validation, and response
        elif self.method in ['POST', 'PUT', 'PATCH']:
            # Test with different request body variations if enabled
            if self.config.get('testParams', True) and request_count < self.max_requests and self.request_body:
                test_count = self._test_request_body_variations()
                request_count += test_count
                
            # Test headers if enabled
            if self.config.get('testHeaders', True) and request_count < self.max_requests:
                test_count = self._test_headers()
                request_count += test_count
                
            # Test response time if enabled
            if self.config.get('testResponseTime', True) and request_count < self.max_requests:
                test_count = min(5, self.max_requests - request_count)  # Up to 5 requests
                self._test_response_time(test_count)
                request_count += test_count
                
            # Test error cases if enabled
            if self.config.get('testErrorCases', True) and request_count < self.max_requests:
                test_count = min(len(self._get_error_cases()), self.max_requests - request_count)
                self._test_error_cases(test_count)
        
        # For DELETE requests: focus on validation and response
        elif self.method == 'DELETE':
            # Test headers if enabled
            if self.config.get('testHeaders', True) and request_count < self.max_requests:
                test_count = self._test_headers()
                request_count += test_count
                
            # Test response time if enabled
            if self.config.get('testResponseTime', True) and request_count < self.max_requests:
                test_count = min(3, self.max_requests - request_count)  # Up to 3 requests
                self._test_response_time(test_count)
                request_count += test_count
                
            # Test error cases if enabled
            if self.config.get('testErrorCases', True) and request_count < self.max_requests:
                test_count = min(len(self._get_error_cases()), self.max_requests - request_count)
                self._test_error_cases(test_count)

    def _test_basic_request(self):
        try:
            request_kwargs = {
                'method': self.method,
                'url': self.endpoint,
                'timeout': 10,
                'headers': self.headers
            }
            
            # Add request body for POST/PUT/PATCH requests
            if self.method in ['POST', 'PUT', 'PATCH'] and self.request_body:
                if isinstance(self.request_body, dict):
                    request_kwargs['json'] = self.request_body
                else:
                    request_kwargs['data'] = self.request_body
            
            start_time = time.time()
            response = requests.request(**request_kwargs)
            duration = time.time() - start_time
            
            # Get response type and sample content
            content_type = response.headers.get('Content-Type', '')
            response_preview = self._get_response_preview(response)

            self.test_results.append({
                'type': 'basic_request',
                'testType': 'Basic Connectivity',
                'element': self.endpoint,
                'elementType': 'endpoint',
                'endpoint': self.endpoint,
                'requestType': self.method,
                'requestBody': self.request_body if self.method in ['POST', 'PUT', 'PATCH'] else None,
                'status': 'passed' if response.status_code < 400 else 'failed',
                'statusCode': response.status_code,
                'duration': duration,
                'responseTime': round(duration * 1000, 2),  # Convert to milliseconds
                'responseSize': len(response.content),
                'contentType': content_type,
                'responsePreview': response_preview,
                'description': f"Basic {self.method} request to endpoint",
                'details': f"Status: {response.status_code}, Size: {len(response.content)} bytes"
            })
        except Exception as e:
            self.test_results.append({
                'type': 'basic_request',
                'testType': 'Basic Connectivity',
                'element': self.endpoint,
                'elementType': 'endpoint',
                'endpoint': self.endpoint,
                'requestType': self.method,
                'requestBody': self.request_body if self.method in ['POST', 'PUT', 'PATCH'] else None,
                'status': 'failed',
                'error': str(e),
                'description': f"Basic {self.method} request to endpoint",
                'details': f"Error: {str(e)}"
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
        
        # Test with different parameter combinations
        test_params = {
            'valid': {'page': '1', 'limit': '10'},
            'invalid': {'page': 'invalid', 'limit': '-1'},
            'empty': {'page': '', 'limit': ''}
        }
        
        tests_run = 0
        for param_type, params in test_params.items():
            if tests_run >= self.max_requests:
                break
                
            try:
                # Build the test URL with parameters for display
                base_url = parsed_url.scheme + "://" + parsed_url.netloc + parsed_url.path
                param_strings = []
                for key, value in params.items():
                    param_strings.append(f"{key}={value}")
                test_url = base_url + "?" + "&".join(param_strings)
                
                start_time = time.time()
                response = requests.request(
                    method=self.method,
                    url=self.endpoint,
                    params=params,
                    headers=self.headers,
                    timeout=10
                )
                duration = time.time() - start_time
                
                # Get response type and sample content
                content_type = response.headers.get('Content-Type', '')
                response_preview = self._get_response_preview(response)

                description = f"Query parameter test with {param_type} parameters"
                param_details = ", ".join([f"{k}={v}" for k, v in params.items()])

                self.test_results.append({
                    'type': 'query_parameters',
                    'testType': 'Parameter Test',
                    'element': test_url,
                    'elementType': 'endpoint',
                    'endpoint': test_url,
                    'requestType': self.method,
                    'parameters': params,
                    'status': 'passed' if response.status_code < 400 else 'failed',
                    'statusCode': response.status_code,
                    'duration': duration,
                    'responseTime': round(duration * 1000, 2),  # Convert to milliseconds
                    'contentType': content_type,
                    'responsePreview': response_preview,
                    'description': description,
                    'details': f"Parameters: {param_details}, Status: {response.status_code}"
                })
                
                tests_run += 1
            except Exception as e:
                description = f"Query parameter test with {param_type} parameters"
                param_details = ", ".join([f"{k}={v}" for k, v in params.items()])
                
                self.test_results.append({
                    'type': 'query_parameters',
                    'testType': 'Parameter Test',
                    'element': self.endpoint,
                    'elementType': 'endpoint',
                    'endpoint': self.endpoint,
                    'requestType': self.method,
                    'parameters': params,
                    'status': 'failed',
                    'error': str(e),
                    'description': description,
                    'details': f"Parameters: {param_details}, Error: {str(e)}"
                })
                
                tests_run += 1
                
        return tests_run

    def _test_request_body_variations(self):
        """Test variations of the request body for POST/PUT/PATCH requests"""
        if not self.request_body or not isinstance(self.request_body, dict):
            return 0
            
        # Create variations of the request body
        tests_run = 0
        variations = []
        
        # 1. Missing required fields
        if len(self.request_body) > 0:
            missing_field = {}
            for key in self.request_body:
                missing_field[key] = self.request_body[key]
            if missing_field:
                key_to_remove = list(missing_field.keys())[0]
                del missing_field[key_to_remove]
                variations.append({
                    'type': 'missing_field',
                    'body': missing_field,
                    'description': f"Missing required field: {key_to_remove}"
                })
                
        # 2. Invalid data types
        if len(self.request_body) > 0:
            invalid_type = dict(self.request_body)
            for key, value in invalid_type.items():
                if isinstance(value, str):
                    invalid_type[key] = 123
                    variations.append({
                        'type': 'invalid_type',
                        'body': invalid_type,
                        'description': f"Invalid type for field: {key}"
                    })
                    break
                elif isinstance(value, (int, float)):
                    invalid_type[key] = "invalid_number"
                    variations.append({
                        'type': 'invalid_type',
                        'body': invalid_type,
                        'description': f"Invalid type for field: {key}"
                    })
                    break
                    
        # 3. Extra fields
        extra_fields = dict(self.request_body)
        extra_fields['extra_field'] = "This is an extra field"
        variations.append({
            'type': 'extra_field',
            'body': extra_fields,
            'description': "Added extra field"
        })
        
        # Run tests for each variation
        for variation in variations:
            if tests_run >= self.max_requests:
                break
                
            try:
                request_kwargs = {
                    'method': self.method,
                    'url': self.endpoint,
                    'json': variation['body'],
                    'headers': self.headers,
                    'timeout': 10
                }
                
                start_time = time.time()
                response = requests.request(**request_kwargs)
                duration = time.time() - start_time
                
                # Get response type and sample content
                content_type = response.headers.get('Content-Type', '')
                response_preview = self._get_response_preview(response)
                
                # For display purposes
                element_display = f"{self.endpoint} [Body Variation: {variation['description']}]"

                self.test_results.append({
                    'type': 'request_body',
                    'element': element_display,
                    'elementType': 'endpoint',
                    'endpoint': self.endpoint,
                    'requestType': self.method,
                    'requestBody': variation['body'],
                    'variationType': variation['type'],
                    'status': 'passed' if response.status_code < 400 else 'failed',
                    'statusCode': response.status_code,
                    'duration': duration,
                    'contentType': content_type,
                    'responsePreview': response_preview
                })
                
                tests_run += 1
            except Exception as e:
                # For display purposes
                element_display = f"{self.endpoint} [Body Variation: {variation['description']}]"
                
                self.test_results.append({
                    'type': 'request_body',
                    'element': element_display,
                    'elementType': 'endpoint',
                    'endpoint': self.endpoint,
                    'requestType': self.method,
                    'requestBody': variation['body'],
                    'variationType': variation['type'],
                    'status': 'failed',
                    'error': str(e)
                })
                
                tests_run += 1
                
        return tests_run

    def _test_headers(self):
        test_headers = [
            {'Accept': 'application/json'},
            {'Accept': 'application/xml'},
            {'Content-Type': 'application/json'},
            {'Authorization': 'Bearer test-token'}
        ]
        
        # Start with base headers and add test headers
        tests_run = 0
        for headers in test_headers:
            if tests_run >= self.max_requests:
                break
                
            # Combine base headers with test headers
            combined_headers = dict(self.headers)
            combined_headers.update(headers)
            
            try:
                request_kwargs = {
                    'method': self.method,
                    'url': self.endpoint,
                    'headers': combined_headers,
                    'timeout': 10
                }
                
                # Add request body for POST/PUT/PATCH requests
                if self.method in ['POST', 'PUT', 'PATCH'] and self.request_body:
                    if isinstance(self.request_body, dict):
                        request_kwargs['json'] = self.request_body
                    else:
                        request_kwargs['data'] = self.request_body
                
                start_time = time.time()
                response = requests.request(**request_kwargs)
                duration = time.time() - start_time
                
                # Format headers for display
                header_str = ", ".join([f"{k}: {v}" for k, v in headers.items()])
                element_display = f"{self.endpoint} [Headers: {header_str}]"
                
                # Get response type and sample content
                content_type = response.headers.get('Content-Type', '')
                response_preview = self._get_response_preview(response)

                self.test_results.append({
                    'type': 'headers',
                    'testType': 'Header Test',
                    'element': element_display,
                    'elementType': 'endpoint',
                    'endpoint': self.endpoint,
                    'requestType': self.method,
                    'headers': headers,
                    'status': 'passed' if response.status_code < 400 else 'failed',
                    'statusCode': response.status_code,
                    'duration': duration,
                    'responseTime': round(duration * 1000, 2),  # Convert to milliseconds
                    'contentType': content_type,
                    'responsePreview': response_preview,
                    'description': f"Testing with custom headers: {header_str}",
                    'details': f"Headers: {header_str}, Status: {response.status_code}"
                })
                
                tests_run += 1
            except Exception as e:
                # Format headers for display
                header_str = ", ".join([f"{k}: {v}" for k, v in headers.items()])
                element_display = f"{self.endpoint} [Headers: {header_str}]"
                
                self.test_results.append({
                    'type': 'headers',
                    'testType': 'Header Test',
                    'element': element_display,
                    'elementType': 'endpoint',
                    'endpoint': self.endpoint,
                    'requestType': self.method,
                    'headers': headers,
                    'status': 'failed',
                    'error': str(e),
                    'description': f"Testing with custom headers: {header_str}",
                    'details': f"Headers: {header_str}, Error: {str(e)}"
                })
                
                tests_run += 1
                
        return tests_run

    def _test_response_time(self, test_count=5):
        response_times = []
        
        tests_run = 0
        for i in range(test_count):
            if tests_run >= self.max_requests:
                break
                
            try:
                request_kwargs = {
                    'method': self.method,
                    'url': self.endpoint,
                    'headers': self.headers,
                    'timeout': 15  # Increased timeout for response time testing
                }
                
                # Add request body for POST/PUT/PATCH requests
                if self.method in ['POST', 'PUT', 'PATCH'] and self.request_body:
                    if isinstance(self.request_body, dict):
                        request_kwargs['json'] = self.request_body
                    else:
                        request_kwargs['data'] = self.request_body
                
                start_time = time.time()
                response = requests.request(**request_kwargs)
                duration = time.time() - start_time
                response_time_ms = round(duration * 1000, 2)  # Convert to milliseconds
                
                response_times.append(response_time_ms)
                
                # Format for display
                element_display = f"{self.endpoint} [Response Time Test #{i+1}]"
                
                self.test_results.append({
                    'type': 'response_time',
                    'testType': 'Response Time',
                    'element': element_display,
                    'elementType': 'endpoint',
                    'endpoint': self.endpoint,
                    'requestType': self.method,
                    'status': 'passed' if response.status_code < 400 else 'failed',
                    'statusCode': response.status_code,
                    'duration': duration,
                    'responseTime': response_time_ms,
                    'description': f"Response time test #{i+1}",
                    'details': f"Response time: {response_time_ms}ms, Status: {response.status_code}"
                })
                
                tests_run += 1
            except Exception as e:
                # Format for display
                element_display = f"{self.endpoint} [Response Time Test #{i+1}]"
                
                self.test_results.append({
                    'type': 'response_time',
                    'testType': 'Response Time',
                    'element': element_display,
                    'elementType': 'endpoint',
                    'endpoint': self.endpoint,
                    'requestType': self.method,
                    'status': 'failed',
                    'error': str(e),
                    'description': f"Response time test #{i+1}",
                    'details': f"Error: {str(e)}"
                })
                
                tests_run += 1
                
        # If we have at least 3 response times, add a summary test result
        if len(response_times) >= 3:
            avg_response_time = sum(response_times) / len(response_times)
            max_response_time = max(response_times)
            min_response_time = min(response_times)
            
            # Determine if response times are acceptable (under 500ms average)
            is_acceptable = avg_response_time < 500
            
            self.test_results.append({
                'type': 'response_time_summary',
                'testType': 'Response Time Summary',
                'element': self.endpoint,
                'elementType': 'endpoint',
                'endpoint': self.endpoint,
                'requestType': self.method,
                'status': 'passed' if is_acceptable else 'failed',
                'responseTime': avg_response_time,
                'maxResponseTime': max_response_time,
                'minResponseTime': min_response_time,
                'description': 'Response time summary',
                'details': f"Average: {avg_response_time}ms, Min: {min_response_time}ms, Max: {max_response_time}ms"
            })
        
        return tests_run

    def _get_error_cases(self):
        """Get appropriate error cases based on the request method"""
        # Common error cases for all methods
        error_cases = [
            {'url': self.endpoint + '/invalid-path'},
            {'timeout': 0.001}  # Very short timeout
        ]
        
        # Method-specific error cases
        if self.method == 'GET':
            error_cases.append({'params': {'invalid': 'param', 'error': 'case'}})
        elif self.method in ['POST', 'PUT', 'PATCH']:
            error_cases.append({'data': 'Invalid data format'})
            error_cases.append({'headers': {'Content-Type': 'invalid/content-type'}})
        elif self.method == 'DELETE':
            error_cases.append({'url': self.endpoint + '/nonexistent-resource'})
            
        return error_cases

    def _test_error_cases(self, test_count=None):
        error_cases = self._get_error_cases()
        
        # Limit to test_count if specified
        if test_count is not None:
            error_cases = error_cases[:test_count]
            
        tests_run = 0
        for case in error_cases:
            # Format case for display
            case_str = ", ".join([f"{k}: {v}" for k, v in case.items()])
            element_display = f"{self.endpoint} [Error Test: {case_str}]"
            
            try:
                request_kwargs = {
                    'method': self.method,
                    'url': self.endpoint,
                    'headers': self.headers,
                    'timeout': 10
                }
                
                # Add request body for POST/PUT/PATCH requests if not overridden by case
                if self.method in ['POST', 'PUT', 'PATCH'] and self.request_body and 'data' not in case and 'json' not in case:
                    if isinstance(self.request_body, dict):
                        request_kwargs['json'] = self.request_body
                    else:
                        request_kwargs['data'] = self.request_body
                
                # Add/override with case specifics
                for key, value in case.items():
                    request_kwargs[key] = value
                
                start_time = time.time()
                response = requests.request(**request_kwargs)
                duration = time.time() - start_time
                
                # Get response type and sample content
                content_type = response.headers.get('Content-Type', '')
                response_preview = self._get_response_preview(response)

                self.test_results.append({
                    'type': 'error_case',
                    'element': element_display,
                    'elementType': 'endpoint',
                    'endpoint': self.endpoint,
                    'requestType': self.method,
                    'case': case,
                    'status': 'passed' if response.status_code >= 400 else 'failed',
                    'statusCode': response.status_code,
                    'duration': duration,
                    'contentType': content_type,
                    'responsePreview': response_preview
                })
                
                tests_run += 1
            except Exception as e:
                self.test_results.append({
                    'type': 'error_case',
                    'element': element_display,
                    'elementType': 'endpoint',
                    'endpoint': self.endpoint,
                    'requestType': self.method,
                    'case': case,
                    'status': 'passed',  # Exception means we successfully tested an error case
                    'error': str(e)
                })
                
                tests_run += 1
                
        return tests_run 