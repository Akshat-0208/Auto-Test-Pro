# 🚀 Auto-Test Pro

**Auto-Test Pro** is a full-stack automation testing platform built with **Flask**, **MongoDB**, and **Selenium**. It allows users to execute automated **UI** and **API** tests — individually, in batches, or as unified suites — with detailed result tracking, performance metrics, and configurable environments.

---

## 📌 Features

* ✅ **Automated UI Testing** with Selenium (forms, buttons, links, images, responsiveness).
* 🔁 **Single, Batch & Unified API Testing** with custom methods, headers, bodies, and validations.
* 📊 **Live Test Analytics**: Pass rate, test duration, result tracking via MongoDB.
* 🌐 **Environment Management** for staging, dev, or production base URLs.
* 🎯 **Error Case Handling** with preview, response type checks, and timeout validations.
* ⚙️ **Configurable Test Depths** and Request Limits.

---

## 🛠️ Tech Stack

* **Backend**: Flask, Flask-CORS, Python
* **Database**: MongoDB (via PyMongo)
* **Testing Libraries**: Selenium, Requests, BeautifulSoup
* **Others**: Python-Dotenv, Gunicorn

---

## 📂 Project Structure

```
Auto-Test-Pro/
├── app.py                # Flask application with all REST APIs
├── api_testing.py        # API testing logic with validations and error handling
├── ui_testing.py         # UI testing using Selenium and page interaction
├── index.html            # React mount point (frontend, optional)
├── requirements.txt      # Python dependencies
```

---

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/auto-test-pro.git
cd auto-test-pro
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Set Environment Variables

Create a `.env` file:

```env
MONGODB_URI=your_mongodb_connection_string
```

> Example: `mongodb+srv://username:password@cluster.mongodb.net/`

### 4. Run the Application

```bash
python app.py
```

> The Flask server will run on `http://localhost:5000`

---

## 🔗 API Endpoints

### UI Testing

```http
POST /api/ui-test
```

**Payload:**

```json
{
  "url": "https://example.com",
  "config": {
    "testLinks": true,
    "testForms": true,
    "testResponsive": true
  }
}
```

---

### API Testing

* `POST /api/api-test` → Single API
* `POST /api/batch-api-test` → Batch APIs
* `POST /api/unified-api-test` → Mixed-method unified test

---

### Results & Environments

* `GET /api/results` → Fetch all test results
* `GET /api/results/<testId>` → Get specific result
* `DELETE /api/results/<testId>` → Delete a test result
* `POST /api/environments` → Create environments

---

## 📊 Output Example

Each test result includes:

* `testsRun`: Total number of tests executed
* `passRate`: Percentage of passed tests
* `duration`: Total execution time
* `testResults`: Detailed results per test step

---

## 💡 Future Improvements

* Web-based dashboard for real-time result visualization
* JWT Auth for test submission
* Docker containerization
* Jenkins/GitHub Actions for CI/CD integration

---

## 📄 License

This project is open-source and free to use for learning or professional automation needs.


