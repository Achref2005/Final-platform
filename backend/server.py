from fastapi import FastAPI, APIRouter, Depends, HTTPException, status, Body, Query
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any, Union
import uuid
from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
import secrets
from enum import Enum

# Setup paths and environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'driving_school_db')]

# Create the main app without a prefix
app = FastAPI(title="Driving School Management API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security setup
SECRET_KEY = os.environ.get("SECRET_KEY", secrets.token_hex(32))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")

# Enums
class UserRole(str, Enum):
    STUDENT = "student"
    TEACHER = "teacher"
    MANAGER = "manager"
    ADMIN = "admin"

class Gender(str, Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"

class CourseType(str, Enum):
    CODE = "code"
    PARKING = "parking"
    ROAD = "road"

class CourseStatus(str, Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"

class ExamStatus(str, Enum):
    SCHEDULED = "scheduled"
    PASSED = "passed"
    FAILED = "failed"

class PaymentStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"

# Models
class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    phone: str
    gender: Gender
    address: str
    state: str  # One of the 58 Algerian states

class UserCreate(UserBase):
    password: str
    role: UserRole = UserRole.STUDENT

class User(UserBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    role: UserRole
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True

    class Config:
        orm_mode = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: str
    role: str

class TokenData(BaseModel):
    user_id: str
    role: str

class DrivingSchoolBase(BaseModel):
    name: str
    description: str
    address: str
    state: str
    city: str
    phone: str
    email: EmailStr
    license_number: str
    price_code: float
    price_parking: float
    price_road: float
    has_female_teachers: bool = False
    has_male_teachers: bool = False
    rating: float = 0.0
    total_ratings: int = 0

class DrivingSchoolCreate(DrivingSchoolBase):
    manager_id: str

class DrivingSchool(DrivingSchoolBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    manager_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True

    class Config:
        orm_mode = True

class TeacherBase(BaseModel):
    driving_school_id: str
    gender: Gender
    years_experience: int
    specialization: List[CourseType]
    bio: str

class TeacherCreate(TeacherBase):
    user_id: str

class Teacher(TeacherBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True

    class Config:
        orm_mode = True

class CourseBase(BaseModel):
    type: CourseType
    student_id: str
    teacher_id: str
    driving_school_id: str
    status: CourseStatus = CourseStatus.NOT_STARTED
    start_date: Optional[datetime] = None
    completion_date: Optional[datetime] = None

class CourseCreate(CourseBase):
    pass

class Course(CourseBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    google_meet_link: Optional[str] = None  # For CODE courses

    class Config:
        orm_mode = True

class ScheduleBase(BaseModel):
    course_id: str
    date: datetime
    duration_minutes: int = 60

class ScheduleCreate(ScheduleBase):
    pass

class Schedule(ScheduleBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        orm_mode = True

class ExamBase(BaseModel):
    course_id: str
    date: datetime
    status: ExamStatus = ExamStatus.SCHEDULED

class ExamCreate(ExamBase):
    pass

class Exam(ExamBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    score: Optional[float] = None
    feedback: Optional[str] = None

    class Config:
        orm_mode = True

class PaymentBase(BaseModel):
    course_id: str
    amount: float
    status: PaymentStatus = PaymentStatus.PENDING

class PaymentCreate(PaymentBase):
    pass

class Payment(PaymentBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    transaction_id: Optional[str] = None

    class Config:
        orm_mode = True

class StatesList(BaseModel):
    states: List[str]

# Authentication functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_user_by_email(email: str):
    user_doc = await db.users.find_one({"email": email})
    if user_doc:
        return User(**user_doc)
    return None

async def authenticate_user(email: str, password: str):
    user = await get_user_by_email(email)
    if not user:
        return False
    user_doc = await db.users.find_one({"email": email})
    if not verify_password(password, user_doc["password"]):
        return False
    return user

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        role: str = payload.get("role")
        if user_id is None or role is None:
            raise credentials_exception
        token_data = TokenData(user_id=user_id, role=role)
    except JWTError:
        raise credentials_exception
    user_doc = await db.users.find_one({"id": token_data.user_id})
    if user_doc is None:
        raise credentials_exception
    return User(**user_doc)

# API Routes
@api_router.post("/auth/register", response_model=User)
async def register_user(user: UserCreate):
    # Check if user already exists
    existing_user = await get_user_by_email(user.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    user_dict = user.dict()
    hashed_password = get_password_hash(user_dict.pop("password"))
    new_user = User(**user_dict)
    user_doc = new_user.dict()
    user_doc["password"] = hashed_password
    
    await db.users.insert_one(user_doc)
    return new_user

@api_router.post("/auth/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.id, "role": user.role}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer", "user_id": user.id, "role": user.role}

@api_router.get("/users/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

@api_router.post("/driving-schools", response_model=DrivingSchool)
async def create_driving_school(
    school: DrivingSchoolCreate,
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.MANAGER and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only managers and admins can create driving schools"
        )
    
    # Create new driving school
    new_school = DrivingSchool(**school.dict())
    await db.driving_schools.insert_one(new_school.dict())
    return new_school

@api_router.get("/driving-schools", response_model=List[DrivingSchool])
async def get_driving_schools(state: Optional[str] = None):
    query = {}
    if state:
        query["state"] = state
    
    schools = await db.driving_schools.find(query).to_list(1000)
    return [DrivingSchool(**school) for school in schools]

@api_router.get("/driving-schools/{school_id}", response_model=DrivingSchool)
async def get_driving_school(school_id: str):
    school = await db.driving_schools.find_one({"id": school_id})
    if not school:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driving school not found"
        )
    return DrivingSchool(**school)

@api_router.post("/teachers", response_model=Teacher)
async def create_teacher(
    teacher: TeacherCreate,
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.MANAGER and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only managers and admins can create teachers"
        )
    
    # Verify the user exists and is a teacher
    user = await db.users.find_one({"id": teacher.user_id})
    if not user or user["role"] != UserRole.TEACHER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user_id or user is not a teacher"
        )
    
    # Verify the driving school exists
    school = await db.driving_schools.find_one({"id": teacher.driving_school_id})
    if not school:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid driving_school_id"
        )
    
    # Create new teacher
    new_teacher = Teacher(**teacher.dict())
    await db.teachers.insert_one(new_teacher.dict())
    
    # Update driving school's teacher gender information
    if new_teacher.gender == Gender.MALE and not school["has_male_teachers"]:
        await db.driving_schools.update_one(
            {"id": teacher.driving_school_id},
            {"$set": {"has_male_teachers": True}}
        )
    elif new_teacher.gender == Gender.FEMALE and not school["has_female_teachers"]:
        await db.driving_schools.update_one(
            {"id": teacher.driving_school_id},
            {"$set": {"has_female_teachers": True}}
        )
    
    return new_teacher

@api_router.get("/teachers", response_model=List[Teacher])
async def get_teachers(
    driving_school_id: Optional[str] = None,
    gender: Optional[Gender] = None
):
    query = {}
    if driving_school_id:
        query["driving_school_id"] = driving_school_id
    if gender:
        query["gender"] = gender
    
    teachers = await db.teachers.find(query).to_list(1000)
    return [Teacher(**teacher) for teacher in teachers]

@api_router.post("/courses", response_model=Course)
async def create_course(
    course: CourseCreate,
    current_user: User = Depends(get_current_user)
):
    # Verify the student exists
    student = await db.users.find_one({"id": course.student_id})
    if not student or student["role"] != UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid student_id"
        )
    
    # Verify the teacher exists
    teacher = await db.teachers.find_one({"id": course.teacher_id})
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid teacher_id"
        )
    
    # Verify the driving school exists
    school = await db.driving_schools.find_one({"id": course.driving_school_id})
    if not school:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid driving_school_id"
        )
    
    # Verify gender matching (male teachers teach male students, female teachers teach female students)
    teacher_user = await db.users.find_one({"id": teacher["user_id"]})
    if teacher_user["gender"] != student["gender"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Teacher and student genders must match"
        )
    
    # For CODE course, no prerequisites
    if course.type == CourseType.CODE:
        # Check if already enrolled in a CODE course
        existing_code_course = await db.courses.find_one({
            "student_id": course.student_id,
            "type": CourseType.CODE,
            "status": {"$ne": CourseStatus.FAILED}
        })
        if existing_code_course:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Student already enrolled in a CODE course"
            )
    
    # For PARKING course, must have completed CODE course
    elif course.type == CourseType.PARKING:
        code_course = await db.courses.find_one({
            "student_id": course.student_id,
            "type": CourseType.CODE,
            "status": CourseStatus.COMPLETED
        })
        if not code_course:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Student must complete CODE course before enrolling in PARKING course"
            )
        
        # Check if already enrolled in a PARKING course
        existing_parking_course = await db.courses.find_one({
            "student_id": course.student_id,
            "type": CourseType.PARKING,
            "status": {"$ne": CourseStatus.FAILED}
        })
        if existing_parking_course:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Student already enrolled in a PARKING course"
            )
    
    # For ROAD course, must have completed PARKING course
    elif course.type == CourseType.ROAD:
        parking_course = await db.courses.find_one({
            "student_id": course.student_id,
            "type": CourseType.PARKING,
            "status": CourseStatus.COMPLETED
        })
        if not parking_course:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Student must complete PARKING course before enrolling in ROAD course"
            )
        
        # Check if already enrolled in a ROAD course
        existing_road_course = await db.courses.find_one({
            "student_id": course.student_id,
            "type": CourseType.ROAD,
            "status": {"$ne": CourseStatus.FAILED}
        })
        if existing_road_course:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Student already enrolled in a ROAD course"
            )
    
    # Create new course
    new_course = Course(**course.dict())
    if course.type == CourseType.CODE:
        new_course.google_meet_link = f"https://meet.google.com/{secrets.token_urlsafe(12)}"
    
    await db.courses.insert_one(new_course.dict())
    
    # For payments - create a pending payment record
    course_price = 0
    if course.type == CourseType.CODE:
        course_price = school["price_code"]
    elif course.type == CourseType.PARKING:
        course_price = school["price_parking"]
    elif course.type == CourseType.ROAD:
        course_price = school["price_road"]
    
    payment = Payment(
        course_id=new_course.id,
        amount=course_price,
        status=PaymentStatus.PENDING
    )
    await db.payments.insert_one(payment.dict())
    
    return new_course

@api_router.get("/courses", response_model=List[Course])
async def get_courses(
    student_id: Optional[str] = None,
    teacher_id: Optional[str] = None,
    driving_school_id: Optional[str] = None,
    type: Optional[CourseType] = None,
    status: Optional[CourseStatus] = None,
    current_user: User = Depends(get_current_user)
):
    query = {}
    
    # Students can only see their own courses
    if current_user.role == UserRole.STUDENT:
        query["student_id"] = current_user.id
    else:
        if student_id:
            query["student_id"] = student_id
    
    # Teachers can only see their own courses
    if current_user.role == UserRole.TEACHER:
        teacher = await db.teachers.find_one({"user_id": current_user.id})
        if teacher:
            query["teacher_id"] = teacher["id"]
    else:
        if teacher_id:
            query["teacher_id"] = teacher_id
    
    # Managers can only see courses from their driving school
    if current_user.role == UserRole.MANAGER:
        school = await db.driving_schools.find_one({"manager_id": current_user.id})
        if school:
            query["driving_school_id"] = school["id"]
    else:
        if driving_school_id:
            query["driving_school_id"] = driving_school_id
    
    if type:
        query["type"] = type
    
    if status:
        query["status"] = status
    
    courses = await db.courses.find(query).to_list(1000)
    return [Course(**course) for course in courses]

@api_router.post("/schedules", response_model=Schedule)
async def create_schedule(
    schedule: ScheduleCreate,
    current_user: User = Depends(get_current_user)
):
    # Only managers and teachers can create schedules
    if current_user.role not in [UserRole.MANAGER, UserRole.TEACHER, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only managers, teachers, and admins can create schedules"
        )
    
    # Verify the course exists
    course = await db.courses.find_one({"id": schedule.course_id})
    if not course:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid course_id"
        )
    
    # Get teacher
    teacher = await db.teachers.find_one({"id": course["teacher_id"]})
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Teacher not found for this course"
        )
    
    # Check if the teacher is creating a schedule for their own course
    if current_user.role == UserRole.TEACHER:
        teacher_record = await db.teachers.find_one({"user_id": current_user.id})
        if not teacher_record or teacher_record["id"] != course["teacher_id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Teachers can only create schedules for their own courses"
            )
    
    # Check scheduling limits
    schedule_date = schedule.date.replace(minute=0, second=0, microsecond=0)
    end_date = schedule_date + timedelta(minutes=schedule.duration_minutes)
    
    # Check if the teacher already has a schedule at this time
    existing_schedule_query = {
        "date": {
            "$lt": end_date,
            "$gte": schedule_date
        }
    }
    
    # Get all courses taught by this teacher
    teacher_courses = await db.courses.find({"teacher_id": course["teacher_id"]}).to_list(1000)
    teacher_course_ids = [c["id"] for c in teacher_courses]
    
    if teacher_course_ids:
        existing_schedule_query["course_id"] = {"$in": teacher_course_ids}
        
        existing_schedules = await db.schedules.find(existing_schedule_query).to_list(1000)
        
        if course["type"] == CourseType.CODE:
            # For CODE courses, a teacher can teach 20 students in one hour
            if len(existing_schedules) >= 20:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Teacher already has the maximum number of CODE students scheduled for this time"
                )
        else:
            # For PARKING and ROAD courses, a teacher can teach only 1 student per hour
            # and maximum 3 PARKING and 3 ROAD students per day
            if existing_schedules:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Teacher already has a student scheduled for this time"
                )
            
            # Check daily limit (3 PARKING and 3 ROAD)
            day_start = schedule_date.replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)
            
            day_schedules_query = {
                "date": {
                    "$gte": day_start,
                    "$lt": day_end
                },
                "course_id": {"$in": teacher_course_ids}
            }
            
            day_schedules = await db.schedules.find(day_schedules_query).to_list(1000)
            
            # Count how many PARKING and ROAD courses are scheduled for this day
            day_course_types = {}
            for ds in day_schedules:
                ds_course = await db.courses.find_one({"id": ds["course_id"]})
                if ds_course:
                    course_type = ds_course["type"]
                    day_course_types[course_type] = day_course_types.get(course_type, 0) + 1
            
            if course["type"] == CourseType.PARKING and day_course_types.get(CourseType.PARKING, 0) >= 3:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Teacher already has the maximum number of PARKING students scheduled for this day"
                )
            
            if course["type"] == CourseType.ROAD and day_course_types.get(CourseType.ROAD, 0) >= 3:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Teacher already has the maximum number of ROAD students scheduled for this day"
                )
    
    # Create new schedule
    new_schedule = Schedule(**schedule.dict())
    await db.schedules.insert_one(new_schedule.dict())
    
    return new_schedule

@api_router.get("/schedules", response_model=List[Schedule])
async def get_schedules(
    course_id: Optional[str] = None,
    student_id: Optional[str] = None,
    teacher_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    current_user: User = Depends(get_current_user)
):
    query = {}
    
    # Filter by course_id
    if course_id:
        query["course_id"] = course_id
    
    # Filter by date range
    date_query = {}
    if start_date:
        date_query["$gte"] = start_date
    if end_date:
        date_query["$lt"] = end_date
    if date_query:
        query["date"] = date_query
    
    # Filter by student or teacher
    course_query = {}
    if student_id:
        course_query["student_id"] = student_id
    if teacher_id:
        course_query["teacher_id"] = teacher_id
    
    # Restrict access based on user role
    if current_user.role == UserRole.STUDENT:
        course_query["student_id"] = current_user.id
    elif current_user.role == UserRole.TEACHER:
        teacher = await db.teachers.find_one({"user_id": current_user.id})
        if teacher:
            course_query["teacher_id"] = teacher["id"]
    elif current_user.role == UserRole.MANAGER:
        school = await db.driving_schools.find_one({"manager_id": current_user.id})
        if school:
            course_query["driving_school_id"] = school["id"]
    
    # Get course IDs matching the course query
    courses = []
    if course_query:
        courses = await db.courses.find(course_query).to_list(1000)
        course_ids = [course["id"] for course in courses]
        
        if not course_ids and (student_id or teacher_id or current_user.role in [UserRole.STUDENT, UserRole.TEACHER, UserRole.MANAGER]):
            return []
        
        if course_ids:
            query["course_id"] = {"$in": course_ids}
    
    schedules = await db.schedules.find(query).to_list(1000)
    return [Schedule(**schedule) for schedule in schedules]

@api_router.post("/exams", response_model=Exam)
async def create_exam(
    exam: ExamCreate,
    current_user: User = Depends(get_current_user)
):
    # Only managers and teachers can create exams
    if current_user.role not in [UserRole.MANAGER, UserRole.TEACHER, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only managers, teachers, and admins can create exams"
        )
    
    # Verify the course exists
    course = await db.courses.find_one({"id": exam.course_id})
    if not course:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid course_id"
        )
    
    # Check if the teacher is creating an exam for their own course
    if current_user.role == UserRole.TEACHER:
        teacher = await db.teachers.find_one({"user_id": current_user.id})
        if not teacher or teacher["id"] != course["teacher_id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Teachers can only create exams for their own courses"
            )
    
    # Create new exam
    new_exam = Exam(**exam.dict())
    await db.exams.insert_one(new_exam.dict())
    
    return new_exam

@api_router.put("/exams/{exam_id}", response_model=Exam)
async def update_exam(
    exam_id: str,
    status: ExamStatus,
    score: Optional[float] = None,
    feedback: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    # Only managers and teachers can update exams
    if current_user.role not in [UserRole.MANAGER, UserRole.TEACHER, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only managers, teachers, and admins can update exams"
        )
    
    # Verify the exam exists
    exam = await db.exams.find_one({"id": exam_id})
    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam not found"
        )
    
    # Verify the course exists
    course = await db.courses.find_one({"id": exam["course_id"]})
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found"
        )
    
    # Check if the teacher is updating an exam for their own course
    if current_user.role == UserRole.TEACHER:
        teacher = await db.teachers.find_one({"user_id": current_user.id})
        if not teacher or teacher["id"] != course["teacher_id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Teachers can only update exams for their own courses"
            )
    
    # Update exam
    update_data = {"status": status}
    if score is not None:
        update_data["score"] = score
    if feedback is not None:
        update_data["feedback"] = feedback
    
    await db.exams.update_one({"id": exam_id}, {"$set": update_data})
    
    # If exam is passed, update course status
    if status == ExamStatus.PASSED:
        await db.courses.update_one(
            {"id": course["id"]},
            {"$set": {"status": CourseStatus.COMPLETED}}
        )
    elif status == ExamStatus.FAILED:
        await db.courses.update_one(
            {"id": course["id"]},
            {"$set": {"status": CourseStatus.FAILED}}
        )
    
    updated_exam = await db.exams.find_one({"id": exam_id})
    return Exam(**updated_exam)

@api_router.get("/exams", response_model=List[Exam])
async def get_exams(
    course_id: Optional[str] = None,
    student_id: Optional[str] = None,
    status: Optional[ExamStatus] = None,
    current_user: User = Depends(get_current_user)
):
    query = {}
    
    # Filter by course_id
    if course_id:
        query["course_id"] = course_id
    
    # Filter by status
    if status:
        query["status"] = status
    
    # Filter by student_id (via course)
    course_query = {}
    if student_id:
        course_query["student_id"] = student_id
    
    # Restrict access based on user role
    if current_user.role == UserRole.STUDENT:
        course_query["student_id"] = current_user.id
    elif current_user.role == UserRole.TEACHER:
        teacher = await db.teachers.find_one({"user_id": current_user.id})
        if teacher:
            course_query["teacher_id"] = teacher["id"]
    elif current_user.role == UserRole.MANAGER:
        school = await db.driving_schools.find_one({"manager_id": current_user.id})
        if school:
            course_query["driving_school_id"] = school["id"]
    
    # Get course IDs matching the course query
    if course_query:
        courses = await db.courses.find(course_query).to_list(1000)
        course_ids = [course["id"] for course in courses]
        
        if not course_ids and (student_id or current_user.role in [UserRole.STUDENT, UserRole.TEACHER, UserRole.MANAGER]):
            return []
        
        if course_ids:
            query["course_id"] = {"$in": course_ids}
    
    exams = await db.exams.find(query).to_list(1000)
    return [Exam(**exam) for exam in exams]

@api_router.post("/payments", response_model=Payment)
async def create_payment(
    payment: PaymentCreate,
    current_user: User = Depends(get_current_user)
):
    # Verify the course exists
    course = await db.courses.find_one({"id": payment.course_id})
    if not course:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid course_id"
        )
    
    # Only the student associated with the course or admins can create payments
    if current_user.role != UserRole.ADMIN and current_user.id != course["student_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only create payments for your own courses"
        )
    
    # Create new payment
    new_payment = Payment(**payment.dict())
    new_payment.transaction_id = f"TXN-{secrets.token_hex(8)}"
    await db.payments.insert_one(new_payment.dict())
    
    return new_payment

@api_router.put("/payments/{payment_id}", response_model=Payment)
async def update_payment(
    payment_id: str,
    status: PaymentStatus,
    current_user: User = Depends(get_current_user)
):
    # Verify the payment exists
    payment = await db.payments.find_one({"id": payment_id})
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )
    
    # Verify the course exists
    course = await db.courses.find_one({"id": payment["course_id"]})
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found"
        )
    
    # Only the student associated with the course, managers, or admins can update payments
    if (current_user.role != UserRole.ADMIN and 
        current_user.role != UserRole.MANAGER and 
        current_user.id != course["student_id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update payments for your own courses"
        )
    
    # Update payment
    await db.payments.update_one({"id": payment_id}, {"$set": {"status": status}})
    
    # If payment is completed, update course status to in progress
    if status == PaymentStatus.COMPLETED and course["status"] == CourseStatus.NOT_STARTED:
        await db.courses.update_one(
            {"id": course["id"]},
            {"$set": {"status": CourseStatus.IN_PROGRESS}}
        )
    
    updated_payment = await db.payments.find_one({"id": payment_id})
    return Payment(**updated_payment)

@api_router.get("/payments", response_model=List[Payment])
async def get_payments(
    course_id: Optional[str] = None,
    student_id: Optional[str] = None,
    status: Optional[PaymentStatus] = None,
    current_user: User = Depends(get_current_user)
):
    query = {}
    
    # Filter by course_id
    if course_id:
        query["course_id"] = course_id
    
    # Filter by status
    if status:
        query["status"] = status
    
    # Filter by student_id (via course)
    course_query = {}
    if student_id:
        course_query["student_id"] = student_id
    
    # Restrict access based on user role
    if current_user.role == UserRole.STUDENT:
        course_query["student_id"] = current_user.id
    elif current_user.role == UserRole.TEACHER:
        teacher = await db.teachers.find_one({"user_id": current_user.id})
        if teacher:
            course_query["teacher_id"] = teacher["id"]
    elif current_user.role == UserRole.MANAGER:
        school = await db.driving_schools.find_one({"manager_id": current_user.id})
        if school:
            course_query["driving_school_id"] = school["id"]
    
    # Get course IDs matching the course query
    if course_query:
        courses = await db.courses.find(course_query).to_list(1000)
        course_ids = [course["id"] for course in courses]
        
        if not course_ids and (student_id or current_user.role in [UserRole.STUDENT, UserRole.TEACHER, UserRole.MANAGER]):
            return []
        
        if course_ids:
            query["course_id"] = {"$in": course_ids}
    
    payments = await db.payments.find(query).to_list(1000)
    return [Payment(**payment) for payment in payments]

@api_router.get("/states", response_model=StatesList)
async def get_states():
    # List of 58 Algerian states
    algeria_states = [
        "Adrar", "Chlef", "Laghouat", "Oum El Bouaghi", "Batna", "Béjaïa", "Biskra", "Béchar", 
        "Blida", "Bouira", "Tamanrasset", "Tébessa", "Tlemcen", "Tiaret", "Tizi Ouzou", "Alger", 
        "Djelfa", "Jijel", "Sétif", "Saïda", "Skikda", "Sidi Bel Abbès", "Annaba", "Guelma", 
        "Constantine", "Médéa", "Mostaganem", "M'Sila", "Mascara", "Ouargla", "Oran", "El Bayadh", 
        "Illizi", "Bordj Bou Arréridj", "Boumerdès", "El Tarf", "Tindouf", "Tissemsilt", "El Oued", 
        "Khenchela", "Souk Ahras", "Tipaza", "Mila", "Aïn Defla", "Naâma", "Aïn Témouchent", 
        "Ghardaïa", "Relizane", "Timimoun", "Bordj Badji Mokhtar", "Ouled Djellal", "Béni Abbès", 
        "In Salah", "In Guezzam", "Touggourt", "Djanet", "El M'Ghair", "El Meniaa"
    ]
    return {"states": algeria_states}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
