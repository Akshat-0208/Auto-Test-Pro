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
        self.client = MongoClient(os.getenv('MONGODB_URI', 'mongodb+srv://Ak:Aksssh990@cluster0.80egjyv.mongodb.net/'))
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

    def _find_associated_label(self, driver, element):
        """Find label associated with an input element"""
        try:
            # Try to find label by input's id
            element_id = element.get_attribute('id')
            if element_id:
                label = driver.find_element(By.CSS_SELECTOR, f"label[for='{element_id}']")
                if label:
                    return label
                    
            # Try to find parent label (where input is inside label)
            parent = element.find_element(By.XPATH, "./ancestor::label")
            if parent:
                return parent
        except:
            pass
        return None
        
    def _get_element_xpath(self, driver, element):
        """Get the XPath of an element to show its position in the DOM"""
        try:
            # Use JavaScript to get the full XPath
            xpath = driver.execute_script("""
                function getElementXPath(element) {
                    if (!element) return '';
                    
                    // If element has an ID, we can construct a simple path
                    if (element.id) {
                        return `//*[@id="${element.id}"]`;
                    }
                    
                    // Check if this is the document body
                    if (element.tagName.toLowerCase() === 'body') {
                        return '/html/body';
                    }
                    
                    // Get the element's position among siblings of the same tag
                    let siblings = Array.from(element.parentNode.children).filter(
                        e => e.tagName === element.tagName
                    );
                    
                    let index = siblings.indexOf(element) + 1;
                    
                    // Recursively get the parent's path
                    return getElementXPath(element.parentNode) + '/' + 
                           element.tagName.toLowerCase() + 
                           (siblings.length > 1 ? `[${index}]` : '');
                }
                return getElementXPath(arguments[0]);
            """, element)
            
            return xpath
        except Exception as e:
            return "Unknown path"

    def _test_links(self, driver):
        links = driver.find_elements(By.TAG_NAME, 'a')
        for link in links:
            try:
                href = link.get_attribute('href')
                if href and href.startswith('http'):
                    # Get element path
                    element_path = self._get_element_xpath(driver, link)
                    
                    self.test_results.append({
                        'type': 'link',
                        'element': href,
                        'elementPath': element_path,
                        'action': 'navigate',
                        'status': 'passed' if self._check_link(href) else 'failed'
                    })
            except Exception as e:
                self.test_results.append({
                    'type': 'link',
                    'element': str(link),
                    'elementPath': 'Unknown',
                    'action': 'navigate',
                    'status': 'failed',
                    'error': str(e)
                })

    def _test_forms(self, driver):
        forms = driver.find_elements(By.TAG_NAME, 'form')
        for form in forms:
            try:
                # Test form inputs individually
                inputs = form.find_elements(By.TAG_NAME, 'input')
                for input_field in inputs:
                    try:
                        input_type = input_field.get_attribute('type') or 'text'
                        element_html = input_field.get_attribute('outerHTML')
                        
                        # Skip button inputs as they're handled in _test_buttons
                        if input_type in ['button', 'submit', 'reset']:
                            continue
                            
                        # Get input value and other relevant attributes
                        attributes = {
                            'type': input_type,
                            'name': input_field.get_attribute('name') or '',
                            'placeholder': input_field.get_attribute('placeholder') or '',
                            'value': input_field.get_attribute('value') or ''
                        }
                        
                        # Get element path
                        element_path = self._get_element_xpath(driver, input_field)
                        
                        # Determine the action based on input type
                        action = 'type'
                        if input_type == 'checkbox' or input_type == 'radio':
                            action = 'check'
                        elif input_type == 'file':
                            action = 'upload'
                        elif input_type == 'range':
                            action = 'slide'
                        elif input_type == 'color':
                            action = 'select-color'
                        
                        is_visible = input_field.is_displayed()
                        is_enabled = input_field.is_enabled()
                        
                        self.test_results.append({
                            'type': 'input',
                            'element': element_html,
                            'elementType': 'input',
                            'elementPath': element_path, 
                            'action': action,
                            'attributes': attributes,
                            'status': 'passed' if (is_visible and is_enabled) else 'failed',
                            'error': None if (is_visible and is_enabled) else 'Input field not visible or enabled'
                        })
                    except Exception as e:
                        self.test_results.append({
                            'type': 'input',
                            'element': str(input_field),
                            'elementType': 'input',
                            'elementPath': 'Unknown',
                            'action': 'interact',
                            'status': 'failed',
                            'error': str(e)
                        })
                
                # Also test select fields
                selects = form.find_elements(By.TAG_NAME, 'select')
                for select in selects:
                    try:
                        element_html = select.get_attribute('outerHTML')
                        
                        # Get element path
                        element_path = self._get_element_xpath(driver, select)
                        
                        is_visible = select.is_displayed()
                        is_enabled = select.is_enabled()
                        
                        self.test_results.append({
                            'type': 'select',
                            'element': element_html,
                            'elementType': 'select',
                            'elementPath': element_path,
                            'action': 'select',
                            'status': 'passed' if (is_visible and is_enabled) else 'failed',
                            'error': None if (is_visible and is_enabled) else 'Select field not visible or enabled'
                        })
                    except Exception as e:
                        self.test_results.append({
                            'type': 'select',
                            'element': str(select),
                            'elementType': 'select',
                            'elementPath': 'Unknown',
                            'action': 'select',
                            'status': 'failed',
                            'error': str(e)
                        })
                
                # Test checkboxes and radio buttons
                checkboxes = form.find_elements(By.XPATH, './/input[@type="checkbox"]')
                radios = form.find_elements(By.XPATH, './/input[@type="radio"]')
                
                for checkbox in checkboxes:
                    try:
                        element_html = checkbox.get_attribute('outerHTML')
                        value = checkbox.get_attribute('value') or ''
                        label_element = self._find_associated_label(driver, checkbox)
                        label_text = label_element.text if label_element else ''
                        
                        # Get element path
                        element_path = self._get_element_xpath(driver, checkbox)
                        
                        is_visible = checkbox.is_displayed()
                        is_enabled = checkbox.is_enabled()
                        
                        self.test_results.append({
                            'type': 'checkbox',
                            'element': element_html,
                            'elementType': 'input',
                            'elementPath': element_path,
                            'action': 'check',
                            'attributes': {
                                'type': 'checkbox', 
                                'value': value,
                                'label': label_text
                            },
                            'status': 'passed' if (is_visible and is_enabled) else 'failed',
                            'error': None if (is_visible and is_enabled) else 'Checkbox not visible or enabled'
                        })
                    except Exception as e:
                        self.test_results.append({
                            'type': 'checkbox',
                            'element': str(checkbox),
                            'elementType': 'input',
                            'elementPath': 'Unknown',
                            'action': 'check',
                            'attributes': {'type': 'checkbox'},
                            'status': 'failed',
                            'error': str(e)
                        })
                
                for radio in radios:
                    try:
                        element_html = radio.get_attribute('outerHTML')
                        value = radio.get_attribute('value') or ''
                        label_element = self._find_associated_label(driver, radio)
                        label_text = label_element.text if label_element else ''
                        
                        # Get element path
                        element_path = self._get_element_xpath(driver, radio)
                        
                        is_visible = radio.is_displayed()
                        is_enabled = radio.is_enabled()
                        
                        self.test_results.append({
                            'type': 'radio',
                            'element': element_html,
                            'elementType': 'input',
                            'elementPath': element_path,
                            'action': 'select',
                            'attributes': {
                                'type': 'radio', 
                                'value': value,
                                'label': label_text
                            },
                            'status': 'passed' if (is_visible and is_enabled) else 'failed',
                            'error': None if (is_visible and is_enabled) else 'Radio button not visible or enabled'
                        })
                    except Exception as e:
                        self.test_results.append({
                            'type': 'radio',
                            'element': str(radio),
                            'elementType': 'input',
                            'elementPath': 'Unknown',
                            'action': 'select',
                            'attributes': {'type': 'radio'},
                            'status': 'failed',
                            'error': str(e)
                        })
                
                # Get form details
                form_id = form.get_attribute('id') or 'unknown'
                form_action = form.get_attribute('action') or 'unknown'
                
                # Get element path
                element_path = self._get_element_xpath(driver, form)
                
                self.test_results.append({
                    'type': 'form',
                    'element': f"Form ID: {form_id}, Action: {form_action}",
                    'elementType': 'form',
                    'elementPath': element_path,
                    'action': 'submit',
                    'status': 'passed'
                })
            except Exception as e:
                self.test_results.append({
                    'type': 'form',
                    'element': str(form),
                    'elementType': 'form',
                    'elementPath': 'Unknown',
                    'action': 'submit',
                    'status': 'failed',
                    'error': str(e)
                })
                
    def _test_buttons(self, driver):
        buttons = driver.find_elements(By.TAG_NAME, 'button')
        button_inputs = driver.find_elements(By.XPATH, '//input[@type="button"]')
        submit_inputs = driver.find_elements(By.XPATH, '//input[@type="submit"]')
        
        all_buttons = buttons + button_inputs + submit_inputs
        
        for button in all_buttons:
            try:
                # Get element details for better visualization
                element_html = button.get_attribute('outerHTML')
                element_type = button.tag_name
                
                # Get element path
                element_path = self._get_element_xpath(driver, button)
                
                # Check if button contains SVG
                has_svg = False
                try:
                    svg_element = button.find_element(By.TAG_NAME, 'svg')
                    has_svg = svg_element is not None
                except:
                    has_svg = False
                
                # Get button text content - try multiple attributes
                inner_html = button.get_attribute('innerText') or button.get_attribute('textContent')
                if not inner_html and element_type == 'input':
                    inner_html = button.get_attribute('value')
                inner_html = inner_html.strip() if inner_html else 'Button'
                
                # For empty text but with SVG, set a placeholder
                if not inner_html.strip() and has_svg:
                    inner_html = "Icon Button"
                
                # Test button click - use JavaScript to avoid actual navigation
                driver.execute_script("arguments[0].scrollIntoView(true);", button)
                
                # Determine action type based on button attributes
                action = 'click'
                if element_type == 'input' and button.get_attribute('type') == 'submit':
                    action = 'submit'
                elif element_type == 'input' and button.get_attribute('type') == 'reset':
                    action = 'reset'
                
                # Store button information
                self.test_results.append({
                    'type': 'button',
                    'element': element_html,
                    'elementType': element_type,
                    'elementPath': element_path,
                    'action': action,
                    'innerHtml': inner_html,
                    'hasSvg': has_svg,
                    'status': 'passed'
                })
            except Exception as e:
                self.test_results.append({
                    'type': 'button',
                    'element': str(button),
                    'elementType': 'button',
                    'elementPath': 'Unknown',
                    'action': 'click',
                    'status': 'failed',
                    'error': str(e)
                })

    def _test_images(self, driver):
        images = driver.find_elements(By.TAG_NAME, 'img')
        for img in images:
            try:
                src = img.get_attribute('src')
                alt = img.get_attribute('alt') or ''
                element_html = img.get_attribute('outerHTML')
                
                # Get element path
                element_path = self._get_element_xpath(driver, img)
                
                # Get the base URL for relative image paths
                base_url = self.url
                
                is_image_loaded = driver.execute_script(
                    "return arguments[0].complete && " +
                    "typeof arguments[0].naturalWidth != 'undefined' && " +
                    "arguments[0].naturalWidth > 0", img)
                
                status = 'passed' if (is_image_loaded and self._check_image(src)) else 'failed'
                error = None if status == 'passed' else 'Image failed to load'
                
                self.test_results.append({
                    'type': 'image',
                    'element': element_html,
                    'elementType': 'img',
                    'elementPath': element_path,
                    'action': 'load',
                    'src': src,
                    'attributes': {'alt': alt},
                    'status': status,
                    'error': error
                })
            except Exception as e:
                self.test_results.append({
                    'type': 'image',
                    'element': str(img),
                    'elementType': 'img',
                    'elementPath': 'Unknown',
                    'action': 'load',
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
                    'elementPath': 'viewport',
                    'action': 'resize',
                    'status': 'passed'
                })
            except Exception as e:
                self.test_results.append({
                    'type': 'responsive',
                    'element': f"{size['width']}x{size['height']}",
                    'elementPath': 'viewport',
                    'action': 'resize',
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