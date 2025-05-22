import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import "./App.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Authentication context
import { createContext, useContext } from "react";

const AuthContext = createContext(null);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userId = localStorage.getItem("userId");
    const userRole = localStorage.getItem("userRole");

    if (token && userId && userRole) {
      setUser({ id: userId, role: userRole, token });
    }
    setLoading(false);
  }, []);

  const login = (token, userId, userRole) => {
    localStorage.setItem("token", token);
    localStorage.setItem("userId", userId);
    localStorage.setItem("userRole", userRole);
    setUser({ id: userId, role: userRole, token });
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    localStorage.removeItem("userRole");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => {
  return useContext(AuthContext);
};

// Protected Route Component
const ProtectedRoute = ({ element, allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login", { state: { from: location } });
    } else if (!loading && user && allowedRoles && !allowedRoles.includes(user.role)) {
      navigate("/unauthorized");
    }
  }, [user, loading, navigate, location, allowedRoles]);

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  return user ? element : null;
};

// API Service
const axiosInstance = axios.create({
  baseURL: API,
});

axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Components
const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <nav className="bg-gray-800 text-white py-3 px-6">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="text-xl font-bold">Algeria Drive</Link>
        <div className="flex space-x-4">
          {user ? (
            <>
              {user.role === "student" && <Link to="/student-dashboard" className="hover:text-gray-300">Dashboard</Link>}
              {user.role === "teacher" && <Link to="/teacher-dashboard" className="hover:text-gray-300">Dashboard</Link>}
              {user.role === "manager" && <Link to="/manager-dashboard" className="hover:text-gray-300">Dashboard</Link>}
              {user.role === "admin" && <Link to="/admin-dashboard" className="hover:text-gray-300">Dashboard</Link>}
              <button onClick={handleLogout} className="hover:text-gray-300">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className="hover:text-gray-300">Login</Link>
              <Link to="/register" className="hover:text-gray-300">Register</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

// Home Page
const Home = () => {
  const [state, setState] = useState("");
  const [states, setStates] = useState([]);
  const [locationPermission, setLocationPermission] = useState(false);
  const [showStatesModal, setShowStatesModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch list of states
    const fetchStates = async () => {
      try {
        const response = await axios.get(`${API}/states`);
        setStates(response.data.states);
      } catch (error) {
        console.error("Error fetching states:", error);
      }
    };

    fetchStates();
  }, []);

  const handleStartRegistration = () => {
    // Ask for location permission
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocationPermission(true);
          // Here you would typically get the state from coordinates
          // For demo purposes, we'll just show the states modal
          setShowStatesModal(true);
        },
        (error) => {
          console.log("Location permission denied:", error);
          setShowStatesModal(true);
        }
      );
    } else {
      console.log("Geolocation not supported");
      setShowStatesModal(true);
    }
  };

  const handleStateSelect = (selectedState) => {
    setState(selectedState);
    setShowStatesModal(false);
    navigate(`/driving-schools?state=${encodeURIComponent(selectedState)}`);
  };

  const handleRegisterDrivingSchool = () => {
    navigate("/register-driving-school");
  };

  return (
    <div className="bg-white">
      {/* Hero section */}
      <div className="relative bg-gray-900 h-[70vh]">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ 
            backgroundImage: "url('https://img.freepik.com/free-photo/driving-instructor-showing-dashboard-student-driving-lesson_23-2149194280.jpg?w=1480&t=st=1711563170~exp=1711563770~hmac=f56af0c1ece4e4f45ee30c626328cd03a54e0dac5bd5264994b0cf069e6e72c9')", 
            opacity: "0.6" 
          }}
        ></div>
        <div className="relative container mx-auto px-6 py-32 flex flex-col items-center justify-center h-full text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">Learn to Drive with Confidence</h1>
          <p className="text-xl text-gray-200 mb-8 max-w-2xl">
            Find the best driving schools in Algeria. Compare prices, read reviews, and start your journey to becoming a licensed driver today.
          </p>
          <button 
            onClick={handleStartRegistration}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition duration-300 transform hover:scale-105"
          >
            Find Driving Schools Near You
          </button>
        </div>
      </div>

      {/* How it works section */}
      <div className="py-16 bg-gray-50">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="w-12 h-12 bg-green-600 text-white rounded-full flex items-center justify-center text-xl font-bold mb-4">1</div>
              <h3 className="text-xl font-semibold mb-3">Find a Driving School</h3>
              <p className="text-gray-600">Browse driving schools in your area, compare prices, and read reviews from other students.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="w-12 h-12 bg-green-600 text-white rounded-full flex items-center justify-center text-xl font-bold mb-4">2</div>
              <h3 className="text-xl font-semibold mb-3">Complete Three Courses</h3>
              <p className="text-gray-600">Learn traffic code, practice parking, and gain road experience with professional instructors.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="w-12 h-12 bg-green-600 text-white rounded-full flex items-center justify-center text-xl font-bold mb-4">3</div>
              <h3 className="text-xl font-semibold mb-3">Get Your License</h3>
              <p className="text-gray-600">Pass your exams with confidence and receive your driving license to start your journey on the road.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Courses section */}
      <div className="py-16">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-4">Our Comprehensive Driving Courses</h2>
          <p className="text-center text-gray-600 mb-12 max-w-3xl mx-auto">
            Our structured approach ensures you learn everything you need to become a safe and confident driver.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="border border-gray-200 rounded-lg overflow-hidden shadow-md">
              <div className="h-48 bg-gray-200 overflow-hidden">
                <img 
                  src="https://img.freepik.com/free-vector/traffic-signs-realistic-collection_1284-3354.jpg?w=1480&t=st=1711563207~exp=1711563807~hmac=04fc8ab6b3b15f54d1f70de4ccab28d7a1f23d4aee992a6dc85f7f5bd2e8fdc1" 
                  alt="Traffic Code Course" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-semibold mb-2">Course 1: Traffic Code</h3>
                <p className="text-gray-600 mb-4">
                  Learn road signs, traffic rules, and intersection priorities through online courses with experienced instructors.
                </p>
                <ul className="text-gray-600 mb-4 space-y-1">
                  <li className="flex items-center">
                    <svg className="w-4 h-4 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                    </svg>
                    Online live sessions
                  </li>
                  <li className="flex items-center">
                    <svg className="w-4 h-4 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                    </svg>
                    Comprehensive study materials
                  </li>
                  <li className="flex items-center">
                    <svg className="w-4 h-4 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                    </svg>
                    Interactive quizzes
                  </li>
                </ul>
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg overflow-hidden shadow-md">
              <div className="h-48 bg-gray-200 overflow-hidden">
                <img 
                  src="https://img.freepik.com/free-photo/driving-school-instructor-teaching-student-how-parking_637285-5437.jpg?w=1480&t=st=1711563227~exp=1711563827~hmac=1b9c3ca8a9b8fbad1bad0d19e7e0b29f24a6c7d4608d81b31f9e3c55fbd26c86" 
                  alt="Parking Course" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-semibold mb-2">Course 2: Parking Maneuvers</h3>
                <p className="text-gray-600 mb-4">
                  Master the art of parking through hands-on practice with a dedicated instructor in a safe environment.
                </p>
                <ul className="text-gray-600 mb-4 space-y-1">
                  <li className="flex items-center">
                    <svg className="w-4 h-4 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                    </svg>
                    One-on-one instruction
                  </li>
                  <li className="flex items-center">
                    <svg className="w-4 h-4 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                    </svg>
                    Practical exercises
                  </li>
                  <li className="flex items-center">
                    <svg className="w-4 h-4 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                    </svg>
                    Different parking techniques
                  </li>
                </ul>
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg overflow-hidden shadow-md">
              <div className="h-48 bg-gray-200 overflow-hidden">
                <img 
                  src="https://img.freepik.com/free-photo/young-woman-driving-car-with-her-instructor_637285-5401.jpg?w=1480&t=st=1711563247~exp=1711563847~hmac=b0f78fb2ad879c4f9dc15c93a0b4a27bb62a9d0c1a28d5f36e14f3eabcb12aee" 
                  alt="Road Driving Course" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-semibold mb-2">Course 3: Road Driving</h3>
                <p className="text-gray-600 mb-4">
                  Gain real-world driving experience on public roads with expert guidance from your instructor.
                </p>
                <ul className="text-gray-600 mb-4 space-y-1">
                  <li className="flex items-center">
                    <svg className="w-4 h-4 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                    </svg>
                    Real traffic conditions
                  </li>
                  <li className="flex items-center">
                    <svg className="w-4 h-4 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                    </svg>
                    Various road types
                  </li>
                  <li className="flex items-center">
                    <svg className="w-4 h-4 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                    </svg>
                    Different weather conditions
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA for driving schools */}
      <div className="py-16 bg-gray-900 text-white">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">Are You a Driving School?</h2>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Join our platform to reach more students and grow your business.
          </p>
          <button 
            onClick={handleRegisterDrivingSchool}
            className="bg-white text-gray-900 hover:bg-gray-200 font-bold py-3 px-8 rounded-lg text-lg transition duration-300"
          >
            Register Your Driving School
          </button>
        </div>
      </div>

      {/* Modal for state selection */}
      {showStatesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Select Your State</h2>
            <p className="text-gray-600 mb-4">
              Please select your state to find driving schools near you.
            </p>
            <ul className="grid grid-cols-2 gap-2">
              {states.map((stateName) => (
                <li key={stateName}>
                  <button
                    onClick={() => handleStateSelect(stateName)}
                    className="w-full text-left p-2 hover:bg-gray-100 rounded"
                  >
                    {stateName}
                  </button>
                </li>
              ))}
            </ul>
            <button
              onClick={() => setShowStatesModal(false)}
              className="mt-4 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Driving Schools List Page
const DrivingSchoolsList = () => {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedGender, setSelectedGender] = useState("");
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const state = queryParams.get("state");

  useEffect(() => {
    const fetchSchools = async () => {
      try {
        const response = await axios.get(`${API}/driving-schools?state=${encodeURIComponent(state || "")}`);
        setSchools(response.data);
        setLoading(false);
      } catch (err) {
        setError("Failed to load driving schools. Please try again later.");
        setLoading(false);
        console.error("Error fetching schools:", err);
      }
    };

    fetchSchools();
  }, [state]);

  // Filter schools based on selected gender
  const filteredSchools = schools.filter(school => {
    if (selectedGender === "male") {
      return school.has_male_teachers;
    } else if (selectedGender === "female") {
      return school.has_female_teachers;
    }
    return true;
  });

  const handleGenderFilter = (gender) => {
    setSelectedGender(gender === selectedGender ? "" : gender);
  };

  if (loading) {
    return <div className="container mx-auto px-6 py-8 text-center">Loading driving schools...</div>;
  }

  if (error) {
    return <div className="container mx-auto px-6 py-8 text-center text-red-600">{error}</div>;
  }

  return (
    <div className="container mx-auto px-6 py-8">
      <h1 className="text-3xl font-bold mb-2">Driving Schools in {state || "Your Area"}</h1>
      <p className="text-gray-600 mb-6">Find and compare driving schools to start your journey.</p>
      
      {/* Filters */}
      <div className="mb-6 bg-gray-100 p-4 rounded-lg">
        <h2 className="font-semibold mb-2">Filters</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleGenderFilter("male")}
            className={`px-4 py-2 rounded ${selectedGender === "male" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
          >
            Male Teachers
          </button>
          <button
            onClick={() => handleGenderFilter("female")}
            className={`px-4 py-2 rounded ${selectedGender === "female" ? "bg-pink-600 text-white" : "bg-gray-200"}`}
          >
            Female Teachers
          </button>
        </div>
      </div>
      
      {filteredSchools.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-xl text-gray-600">No driving schools found matching your criteria.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSchools.map((school) => (
            <div key={school.id} className="border rounded-lg overflow-hidden shadow-md">
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-2">{school.name}</h2>
                <p className="text-gray-600 mb-4">{school.description}</p>
                <div className="mb-4">
                  <div className="flex items-center mb-1">
                    <svg className="w-5 h-5 text-gray-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    </svg>
                    <span>{school.address}, {school.city}, {school.state}</span>
                  </div>
                  <div className="flex items-center mb-1">
                    <svg className="w-5 h-5 text-gray-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
                    </svg>
                    <span>{school.phone}</span>
                  </div>
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-gray-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                    </svg>
                    <span>{school.email}</span>
                  </div>
                </div>
                <div className="mb-4">
                  <div className="flex items-center mb-1">
                    <div className="text-sm bg-gray-200 px-2 py-1 rounded mr-2">
                      Code: {school.price_code.toFixed(2)} DZD
                    </div>
                    <div className="text-sm bg-gray-200 px-2 py-1 rounded mr-2">
                      Parking: {school.price_parking.toFixed(2)} DZD
                    </div>
                    <div className="text-sm bg-gray-200 px-2 py-1 rounded">
                      Road: {school.price_road.toFixed(2)} DZD
                    </div>
                  </div>
                </div>
                <div className="mb-4 flex items-center">
                  <div className="flex mr-4">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} className={`w-5 h-5 ${i < Math.round(school.rating) ? "text-yellow-400" : "text-gray-300"}`} fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                      </svg>
                    ))}
                  </div>
                  <span className="text-sm text-gray-600">({school.total_ratings} reviews)</span>
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {school.has_male_teachers && (
                    <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">Male teachers</span>
                  )}
                  {school.has_female_teachers && (
                    <span className="inline-block bg-pink-100 text-pink-800 text-xs px-2 py-1 rounded">Female teachers</span>
                  )}
                </div>
                <Link 
                  to={`/driving-school/${school.id}`}
                  className="block w-full bg-green-600 hover:bg-green-700 text-white text-center font-semibold py-2 px-4 rounded"
                >
                  View Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Login Page
const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || "/";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await axiosInstance.post("/auth/token", {
        username: email,
        password: password
      }, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      });

      login(response.data.access_token, response.data.user_id, response.data.role);
      
      // Redirect based on role
      if (response.data.role === "student") {
        navigate("/student-dashboard");
      } else if (response.data.role === "teacher") {
        navigate("/teacher-dashboard");
      } else if (response.data.role === "manager") {
        navigate("/manager-dashboard");
      } else if (response.data.role === "admin") {
        navigate("/admin-dashboard");
      } else {
        navigate(from);
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
        </div>
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email-address" className="sr-only">Email address</label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-green-500 focus:border-green-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-green-500 focus:border-green-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </div>
          
          <div className="text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{" "}
              <Link to="/register" className="font-medium text-green-600 hover:text-green-500">
                Register here
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

// Register Page
const Register = () => {
  const [formData, setFormData] = useState({
    email: "",
    full_name: "",
    phone: "",
    gender: "male",
    address: "",
    state: "",
    password: "",
    confirmPassword: "",
    role: "student"
  });
  const [states, setStates] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch list of states
    const fetchStates = async () => {
      try {
        const response = await axios.get(`${API}/states`);
        setStates(response.data.states);
      } catch (error) {
        console.error("Error fetching states:", error);
      }
    };

    fetchStates();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    
    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    
    setLoading(true);
    
    try {
      const { confirmPassword, ...registrationData } = formData;
      
      // Register user
      await axiosInstance.post("/auth/register", registrationData);
      
      // Login user
      const loginResponse = await axiosInstance.post("/auth/token", {
        username: formData.email,
        password: formData.password
      }, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      });
      
      login(loginResponse.data.access_token, loginResponse.data.user_id, loginResponse.data.role);
      
      // Redirect based on role
      if (loginResponse.data.role === "student") {
        navigate("/student-dashboard");
      } else if (loginResponse.data.role === "teacher") {
        navigate("/teacher-dashboard");
      } else if (loginResponse.data.role === "manager") {
        navigate("/manager-dashboard");
      } else {
        navigate("/");
      }
    } catch (err) {
      console.error("Registration error:", err);
      setError(err.response?.data?.detail || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto bg-white p-8 rounded-lg shadow">
        <div>
          <h2 className="text-center text-3xl font-extrabold text-gray-900">
            Create your account
          </h2>
        </div>
        {error && (
          <div className="mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                value={formData.email}
                onChange={handleChange}
              />
            </div>
            
            <div>
              <label htmlFor="full_name" className="block text-sm font-medium text-gray-700">Full name</label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                autoComplete="name"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                value={formData.full_name}
                onChange={handleChange}
              />
            </div>
            
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Phone number</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                value={formData.phone}
                onChange={handleChange}
              />
            </div>
            
            <div>
              <label htmlFor="gender" className="block text-sm font-medium text-gray-700">Gender</label>
              <select
                id="gender"
                name="gender"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                value={formData.gender}
                onChange={handleChange}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700">Address</label>
              <input
                id="address"
                name="address"
                type="text"
                autoComplete="street-address"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                value={formData.address}
                onChange={handleChange}
              />
            </div>
            
            <div>
              <label htmlFor="state" className="block text-sm font-medium text-gray-700">State</label>
              <select
                id="state"
                name="state"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                value={formData.state}
                onChange={handleChange}
              >
                <option value="">Select a state</option>
                {states.map((state) => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700">Register as</label>
              <select
                id="role"
                name="role"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                value={formData.role}
                onChange={handleChange}
              >
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
                <option value="manager">Driving School Manager</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                value={formData.password}
                onChange={handleChange}
              />
            </div>
            
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">Confirm password</label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                value={formData.confirmPassword}
                onChange={handleChange}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              {loading ? "Registering..." : "Register"}
            </button>
          </div>
          
          <div className="text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{" "}
              <Link to="/login" className="font-medium text-green-600 hover:text-green-500">
                Sign in
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

// Register Driving School Page
const RegisterDrivingSchool = () => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    address: "",
    city: "",
    state: "",
    phone: "",
    email: "",
    license_number: "",
    price_code: 0,
    price_parking: 0,
    price_road: 0,
    has_female_teachers: false,
    has_male_teachers: false
  });
  const [states, setStates] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || user.role !== "manager") {
      navigate("/register?role=manager");
      return;
    }

    // Fetch list of states
    const fetchStates = async () => {
      try {
        const response = await axios.get(`${API}/states`);
        setStates(response.data.states);
      } catch (error) {
        console.error("Error fetching states:", error);
      }
    };

    fetchStates();
  }, [user, navigate]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : (type === "number" ? parseFloat(value) : value)
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);

    try {
      const schoolData = {
        ...formData,
        manager_id: user.id
      };

      await axiosInstance.post("/driving-schools", schoolData);
      setSuccess(true);
      
      // Reset form
      setFormData({
        name: "",
        description: "",
        address: "",
        city: "",
        state: "",
        phone: "",
        email: "",
        license_number: "",
        price_code: 0,
        price_parking: 0,
        price_road: 0,
        has_female_teachers: false,
        has_male_teachers: false
      });
      
      // Redirect to manager dashboard
      setTimeout(() => {
        navigate("/manager-dashboard");
      }, 3000);
    } catch (err) {
      console.error("Registration error:", err);
      setError(err.response?.data?.detail || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-lg mx-auto bg-white p-8 rounded-lg shadow">
        <div>
          <h2 className="text-center text-3xl font-extrabold text-gray-900">
            Register Your Driving School
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter your driving school details to join our platform
          </p>
        </div>
        
        {error && (
          <div className="mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}
        
        {success && (
          <div className="mt-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative" role="alert">
            <span className="block sm:inline">Driving school registered successfully! Redirecting to dashboard...</span>
          </div>
        )}
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">School Name</label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                value={formData.name}
                onChange={handleChange}
              />
            </div>
            
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                id="description"
                name="description"
                rows="3"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                value={formData.description}
                onChange={handleChange}
              ></textarea>
            </div>
            
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700">Address</label>
              <input
                id="address"
                name="address"
                type="text"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                value={formData.address}
                onChange={handleChange}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="city" className="block text-sm font-medium text-gray-700">City</label>
                <input
                  id="city"
                  name="city"
                  type="text"
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                  value={formData.city}
                  onChange={handleChange}
                />
              </div>
              
              <div>
                <label htmlFor="state" className="block text-sm font-medium text-gray-700">State</label>
                <select
                  id="state"
                  name="state"
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                  value={formData.state}
                  onChange={handleChange}
                >
                  <option value="">Select a state</option>
                  {states.map((state) => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Phone</label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                  value={formData.phone}
                  onChange={handleChange}
                />
              </div>
              
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="license_number" className="block text-sm font-medium text-gray-700">License Number</label>
              <input
                id="license_number"
                name="license_number"
                type="text"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                value={formData.license_number}
                onChange={handleChange}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Course Prices (DZD)</label>
              <div className="grid grid-cols-3 gap-4 mt-1">
                <div>
                  <label htmlFor="price_code" className="block text-xs text-gray-500">Code</label>
                  <input
                    id="price_code"
                    name="price_code"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    value={formData.price_code}
                    onChange={handleChange}
                  />
                </div>
                
                <div>
                  <label htmlFor="price_parking" className="block text-xs text-gray-500">Parking</label>
                  <input
                    id="price_parking"
                    name="price_parking"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    value={formData.price_parking}
                    onChange={handleChange}
                  />
                </div>
                
                <div>
                  <label htmlFor="price_road" className="block text-xs text-gray-500">Road</label>
                  <input
                    id="price_road"
                    name="price_road"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    value={formData.price_road}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Teacher Gender Availability</label>
              <div className="mt-2 space-y-2">
                <div className="flex items-center">
                  <input
                    id="has_male_teachers"
                    name="has_male_teachers"
                    type="checkbox"
                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                    checked={formData.has_male_teachers}
                    onChange={handleChange}
                  />
                  <label htmlFor="has_male_teachers" className="ml-2 block text-sm text-gray-700">
                    Male Teachers Available
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    id="has_female_teachers"
                    name="has_female_teachers"
                    type="checkbox"
                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                    checked={formData.has_female_teachers}
                    onChange={handleChange}
                  />
                  <label htmlFor="has_female_teachers" className="ml-2 block text-sm text-gray-700">
                    Female Teachers Available
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              {loading ? "Registering..." : "Register Driving School"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Student Dashboard Page (placeholder)
const StudentDashboard = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Student Dashboard</h1>
      <p className="mb-4">Welcome to your student dashboard. Here you can manage your courses and view your progress.</p>
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Your Courses</h2>
        <p className="text-gray-500">No courses enrolled yet.</p>
      </div>
    </div>
  );
};

// Teacher Dashboard Page (placeholder)
const TeacherDashboard = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Teacher Dashboard</h1>
      <p className="mb-4">Welcome to your teacher dashboard. Here you can manage your students and schedule.</p>
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Your Students</h2>
        <p className="text-gray-500">No students assigned yet.</p>
      </div>
    </div>
  );
};

// Manager Dashboard Page (placeholder)
const ManagerDashboard = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Manager Dashboard</h1>
      <p className="mb-4">Welcome to your manager dashboard. Here you can manage your driving school.</p>
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Your Driving School</h2>
        <p className="text-gray-500">Configure your driving school settings and manage teachers and students.</p>
      </div>
    </div>
  );
};

// Unauthorized Page
const Unauthorized = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Unauthorized Access
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            You don't have permission to access this page.
          </p>
          <div className="mt-6">
            <Link to="/" className="font-medium text-green-600 hover:text-green-500">
              Return to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

// NotFound Page
const NotFound = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            404 - Page Not Found
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            The page you are looking for does not exist.
          </p>
          <div className="mt-6">
            <Link to="/" className="font-medium text-green-600 hover:text-green-500">
              Return to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main App Component
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col">
          <Navbar />
          <main className="flex-grow">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/driving-schools" element={<DrivingSchoolsList />} />
              <Route path="/register-driving-school" element={
                <ProtectedRoute 
                  element={<RegisterDrivingSchool />} 
                  allowedRoles={["manager"]} 
                />
              } />
              <Route path="/student-dashboard" element={
                <ProtectedRoute 
                  element={<StudentDashboard />} 
                  allowedRoles={["student"]} 
                />
              } />
              <Route path="/teacher-dashboard" element={
                <ProtectedRoute 
                  element={<TeacherDashboard />} 
                  allowedRoles={["teacher"]} 
                />
              } />
              <Route path="/manager-dashboard" element={
                <ProtectedRoute 
                  element={<ManagerDashboard />} 
                  allowedRoles={["manager"]} 
                />
              } />
              <Route path="/unauthorized" element={<Unauthorized />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
          <footer className="bg-gray-800 text-white py-8">
            <div className="container mx-auto px-6">
              <div className="flex flex-col md:flex-row justify-between">
                <div className="mb-6 md:mb-0">
                  <h2 className="text-xl font-bold mb-4">Algeria Drive</h2>
                  <p className="text-gray-400 max-w-xs">The leading platform for connecting students with driving schools across Algeria.</p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
                  <ul className="space-y-2">
                    <li><Link to="/" className="text-gray-400 hover:text-white">Home</Link></li>
                    <li><Link to="/driving-schools" className="text-gray-400 hover:text-white">Find Driving Schools</Link></li>
                    <li><Link to="/login" className="text-gray-400 hover:text-white">Login</Link></li>
                    <li><Link to="/register" className="text-gray-400 hover:text-white">Register</Link></li>
                  </ul>
                </div>
              </div>
              <div className="mt-8 pt-8 border-t border-gray-700 text-sm text-gray-400 text-center">
                <p>&copy; {new Date().getFullYear()} Algeria Drive. All rights reserved.</p>
              </div>
            </div>
          </footer>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
