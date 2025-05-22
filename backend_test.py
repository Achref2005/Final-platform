
import requests
import sys
import random
import string
from datetime import datetime

class DrivingSchoolAPITester:
    def __init__(self, base_url="https://5cd520e4-32b7-472c-8639-0c2a419f5076.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.user_role = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_data = {}

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json().get('detail', 'No detail provided')
                    print(f"Error detail: {error_detail}")
                except:
                    print("Could not parse error response")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def generate_test_data(self):
        """Generate random test data for user registration"""
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        random_str = ''.join(random.choices(string.ascii_lowercase, k=5))
        
        self.test_data = {
            "student": {
                "email": f"student_{random_str}_{timestamp}@test.com",
                "full_name": f"Test Student {random_str}",
                "phone": f"+213{random.randint(500000000, 599999999)}",
                "gender": "male",
                "address": f"{random.randint(1, 100)} Test Street",
                "state": "Alger",
                "password": "Test123!",
                "role": "student"
            },
            "teacher": {
                "email": f"teacher_{random_str}_{timestamp}@test.com",
                "full_name": f"Test Teacher {random_str}",
                "phone": f"+213{random.randint(600000000, 699999999)}",
                "gender": "male",
                "address": f"{random.randint(1, 100)} Teacher Street",
                "state": "Alger",
                "password": "Test123!",
                "role": "teacher"
            },
            "manager": {
                "email": f"manager_{random_str}_{timestamp}@test.com",
                "full_name": f"Test Manager {random_str}",
                "phone": f"+213{random.randint(700000000, 799999999)}",
                "gender": "male",
                "address": f"{random.randint(1, 100)} Manager Street",
                "state": "Alger",
                "password": "Test123!",
                "role": "manager"
            },
            "driving_school": {
                "name": f"Test Driving School {random_str}",
                "description": "A test driving school for API testing",
                "address": f"{random.randint(1, 100)} School Street",
                "state": "Alger",
                "city": "Algiers",
                "phone": f"+213{random.randint(800000000, 899999999)}",
                "email": f"school_{random_str}_{timestamp}@test.com",
                "license_number": f"LIC-{random.randint(10000, 99999)}",
                "price_code": random.randint(5000, 10000),
                "price_parking": random.randint(10000, 20000),
                "price_road": random.randint(15000, 30000),
                "has_female_teachers": False,
                "has_male_teachers": True
            }
        }

    def test_get_states(self):
        """Test getting the list of states"""
        success, response = self.run_test(
            "Get States",
            "GET",
            "states",
            200
        )
        if success and 'states' in response:
            print(f"Retrieved {len(response['states'])} states")
            return True
        return False

    def test_register_user(self, user_type):
        """Test user registration"""
        success, response = self.run_test(
            f"Register {user_type}",
            "POST",
            "auth/register",
            200,
            data=self.test_data[user_type]
        )
        if success and 'id' in response:
            print(f"{user_type.capitalize()} registered with ID: {response['id']}")
            if user_type == "student":
                self.test_data["student_id"] = response['id']
            elif user_type == "teacher":
                self.test_data["teacher_id"] = response['id']
            elif user_type == "manager":
                self.test_data["manager_id"] = response['id']
            return True
        return False

    def test_login(self, user_type):
        """Test login and get token"""
        form_data = {
            "username": self.test_data[user_type]["email"],
            "password": self.test_data[user_type]["password"]
        }
        
        success, response = self.run_test(
            f"Login as {user_type}",
            "POST",
            "auth/token",
            200,
            data=form_data
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user_id']
            self.user_role = response['role']
            print(f"Logged in as {user_type} with role: {self.user_role}")
            return True
        return False

    def test_get_user_profile(self):
        """Test getting user profile"""
        success, response = self.run_test(
            "Get User Profile",
            "GET",
            "users/me",
            200
        )
        if success and 'id' in response:
            print(f"Retrieved profile for user: {response['full_name']}")
            return True
        return False

    def test_register_driving_school(self):
        """Test registering a driving school"""
        # Add manager_id to the driving school data
        school_data = self.test_data["driving_school"].copy()
        school_data["manager_id"] = self.user_id
        
        success, response = self.run_test(
            "Register Driving School",
            "POST",
            "driving-schools",
            200,
            data=school_data
        )
        
        if success and 'id' in response:
            self.test_data["school_id"] = response['id']
            print(f"Driving school registered with ID: {response['id']}")
            return True
        return False

    def test_get_driving_schools(self, state=None):
        """Test getting list of driving schools"""
        params = {"state": state} if state else None
        
        success, response = self.run_test(
            f"Get Driving Schools{' in ' + state if state else ''}",
            "GET",
            "driving-schools",
            200,
            params=params
        )
        
        if success:
            print(f"Retrieved {len(response)} driving schools")
            return True
        return False

    def test_get_driving_school_by_id(self):
        """Test getting a specific driving school by ID"""
        if "school_id" not in self.test_data:
            print("❌ No school ID available for testing")
            return False
            
        success, response = self.run_test(
            "Get Driving School by ID",
            "GET",
            f"driving-schools/{self.test_data['school_id']}",
            200
        )
        
        if success and 'id' in response:
            print(f"Retrieved driving school: {response['name']}")
            return True
        return False

def main():
    # Setup
    tester = DrivingSchoolAPITester()
    tester.generate_test_data()
    
    # Test 1: Get states
    if not tester.test_get_states():
        print("❌ Failed to get states, stopping tests")
        return 1
    
    # Test 2: Register a student
    if not tester.test_register_user("student"):
        print("❌ Student registration failed, stopping tests")
        return 1
    
    # Test 3: Login as student
    if not tester.test_login("student"):
        print("❌ Student login failed, stopping tests")
        return 1
    
    # Test 4: Get student profile
    if not tester.test_get_user_profile():
        print("❌ Getting student profile failed")
    
    # Test 5: Register a manager
    tester.token = None  # Clear token to register as a new user
    if not tester.test_register_user("manager"):
        print("❌ Manager registration failed, stopping tests")
        return 1
    
    # Test 6: Login as manager
    if not tester.test_login("manager"):
        print("❌ Manager login failed, stopping tests")
        return 1
    
    # Test 7: Register a driving school
    if not tester.test_register_driving_school():
        print("❌ Driving school registration failed")
    
    # Test 8: Get driving schools (all)
    if not tester.test_get_driving_schools():
        print("❌ Getting driving schools failed")
    
    # Test 9: Get driving schools by state
    if not tester.test_get_driving_schools("Alger"):
        print("❌ Getting driving schools by state failed")
    
    # Test 10: Get driving school by ID
    if not tester.test_get_driving_school_by_id():
        print("❌ Getting driving school by ID failed")
    
    # Print results
    print(f"\n📊 Tests passed: {tester.tests_passed}/{tester.tests_run}")
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())
