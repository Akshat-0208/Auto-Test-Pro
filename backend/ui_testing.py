from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from bs4 import BeautifulSoup
import requests
import time
from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

class UITester:
    def __init__(self, url, config):
        self.url = url
        self.config = config
        self.client = MongoClient(os.getenv('MONGODB_URI', 'mongodb://localhost:27017/'))
        self.db = self.client.autotester
        self.results_collection = self.db.results
        self.visited_urls = set()
        self.test_results = []

    def run_tests(self, result_id):
        try:
            start_time = time.time()
            self._test_page(self.url, depth=0)
            
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

    def _test_page(self, url, depth):
        if url in self.visited_urls or depth > self.config.get('maxDepth', 3):
            return

        self.visited_urls.add(url)
        driver = webdriver.Chrome()  # You might want to use a headless browser in production
        driver.get(url)

        try:
            # Test links if enabled
            if self.config.get('testLinks', True):
                self._test_links(driver)

            # Test forms if enabled
            if self.config.get('testForms', True):
                self._test_forms(driver)

            # Test buttons if enabled
            if self.config.get('testButtons', True):
                self._test_buttons(driver)

            # Test images if enabled
            if self.config.get('testImages', True):
                self._test_images(driver)

            # Test responsive design if enabled
            if self.config.get('testResponsive', True):
                self._test_responsive(driver)

        finally:
            driver.quit()

    def _test_links(self, driver):
        links = driver.find_elements(By.TAG_NAME, 'a')
        for link in links:
            try:
                href = link.get_attribute('href')
                if href and href.startswith('http'):
                    self.test_results.append({
                        'type': 'link',
                        'element': href,
                        'status': 'passed' if self._check_link(href) else 'failed'
                    })
            except Exception as e:
                self.test_results.append({
                    'type': 'link',
                    'element': str(link),
                    'status': 'failed',
                    'error': str(e)
                })

    def _test_forms(self, driver):
        forms = driver.find_elements(By.TAG_NAME, 'form')
        for form in forms:
            try:
                # Test form submission
                inputs = form.find_elements(By.TAG_NAME, 'input')
                for input_field in inputs:
                    input_type = input_field.get_attribute('type')
                    if input_type in ['text', 'email', 'password']:
                        input_field.send_keys('test')
                
                self.test_results.append({
                    'type': 'form',
                    'element': form.get_attribute('id') or 'unnamed_form',
                    'status': 'passed'
                })
            except Exception as e:
                self.test_results.append({
                    'type': 'form',
                    'element': str(form),
                    'status': 'failed',
                    'error': str(e)
                })

    def _test_buttons(self, driver):
        buttons = driver.find_elements(By.TAG_NAME, 'button')
        for button in buttons:
            try:
                # Test button click
                button.click()
                self.test_results.append({
                    'type': 'button',
                    'element': button.get_attribute('id') or 'unnamed_button',
                    'status': 'passed'
                })
            except Exception as e:
                self.test_results.append({
                    'type': 'button',
                    'element': str(button),
                    'status': 'failed',
                    'error': str(e)
                })

    def _test_images(self, driver):
        images = driver.find_elements(By.TAG_NAME, 'img')
        for img in images:
            try:
                src = img.get_attribute('src')
                if src:
                    self.test_results.append({
                        'type': 'image',
                        'element': src,
                        'status': 'passed' if self._check_image(src) else 'failed'
                    })
            except Exception as e:
                self.test_results.append({
                    'type': 'image',
                    'element': str(img),
                    'status': 'failed',
                    'error': str(e)
                })

    def _test_responsive(self, driver):
        viewport_sizes = [
            {'width': 320, 'height': 568},  # iPhone 5
            {'width': 375, 'height': 667},  # iPhone 6
            {'width': 768, 'height': 1024}, # iPad
            {'width': 1024, 'height': 768}, # Desktop
        ]

        for size in viewport_sizes:
            try:
                driver.set_window_size(size['width'], size['height'])
                self.test_results.append({
                    'type': 'responsive',
                    'element': f"{size['width']}x{size['height']}",
                    'status': 'passed'
                })
            except Exception as e:
                self.test_results.append({
                    'type': 'responsive',
                    'element': f"{size['width']}x{size['height']}",
                    'status': 'failed',
                    'error': str(e)
                })

    def _check_link(self, url):
        try:
            response = requests.head(url, timeout=5)
            return response.status_code < 400
        except:
            return False

    def _check_image(self, url):
        try:
            response = requests.head(url, timeout=5)
            return response.status_code < 400 and 'image' in response.headers.get('content-type', '')
        except:
            return False 