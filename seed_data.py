import datetime
import random
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Base, WorkerModel, PermitLog

DATABASE_URL = "sqlite:///./safeguard.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Nodes mapping for coordinate matching
NODES = {
    1: {"name": "Main Entrance", "x": 100.0, "y": 500.0},
    2: {"name": "Assembly Line A", "x": 300.0, "y": 300.0},
    3: {"name": "Assembly Line B", "x": 300.0, "y": 700.0},
    4: {"name": "Gas Storage Zone", "x": 600.0, "y": 300.0},
    5: {"name": "Hot Work Zone", "x": 600.0, "y": 700.0},
    6: {"name": "Emergency Exit", "x": 900.0, "y": 500.0}
}

WORKER_NAMES = [
    ("Rajesh Kumar", "Pipefitter", "#3b82f6"),
    ("Ananya Sharma", "Electrical Technician", "#10b981"),
    ("Marcus Aurelius", "Safety Engineer", "#ec4899"),
    ("Kenji Sato", "Process Operator", "#f59e0b"),
    ("Elena Rostova", "Maintenance Supervisor", "#8b5cf6"),
    ("Carlos Mendez", "Welding Inspector", "#06b6d4"),
    ("Sarah Jenkins", "Instrument Specialist", "#14b8a6"),
    ("David Vance", "Chemical Engineer", "#e11d48"),
    ("Amina Diallo", "HVAC Technician", "#6366f1"),
    ("Li Wei", "Control Systems Lead", "#a855f7"),
    ("Vikram Singh", "Mechanical Tech", "#0ea5e9"),
    ("Sophie Dubois", "HSE Coordinator", "#10b981"),
    ("John Miller", "Millwright", "#3b82f6"),
    ("Hiroshi Tanaka", "Operations Manager", "#f59e0b"),
    ("Maria Rossi", "Scaffolder", "#ec4899"),
    ("Pavel Petrov", "Valves Specialist", "#8b5cf6"),
    ("Fatima Al-Sayed", "Analyst", "#06b6d4"),
    ("Hans Mueller", "Boiler Operator", "#e11d48"),
    ("Chao Wang", "Project Engineer", "#6366f1"),
    ("Lucia Santos", "Lab Technician", "#14b8a6"),
    ("Ahmed Mansour", "Turbine Tech", "#a855f7"),
    ("Yuki Sato", "Inspector", "#0ea5e9")
]

def seed_database():
    print("[SafeGuard Seeder] Initializing database schema...")
    Base.metadata.drop_all(bind=engine) # clean slate
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # 1. Seed Permit Logs
        print("[SafeGuard Seeder] Seeding initial permit logs...")
        permits = [
            PermitLog(zone_id=4, zone_name="Gas Storage Zone", permit_type="Hot Work", status="Active"),
            PermitLog(zone_id=5, zone_name="Hot Work Zone", permit_type="Hot Work", status="Active"),
            PermitLog(zone_id=2, zone_name="Assembly Line A", permit_type="Cold Work", status="Closed"),
            PermitLog(zone_id=3, zone_name="Assembly Line B", permit_type="Confined Space Entry", status="Closed")
        ]
        db.add_all(permits)
        
        # 2. Seed 20+ Workers
        print("[SafeGuard Seeder] Seeding 22 industrial workers...")
        db_workers = []
        for i, (name, role, color) in enumerate(WORKER_NAMES, start=101):
            w_id = f"W-{i}"
            # Pick a starting node (exclude exits 1 and 6 for realistic spawning)
            start_node_id = random.choice([2, 3, 4, 5])
            node_coords = NODES[start_node_id]
            
            # Slightly offset coordinates so worker dots don't overlap perfectly
            x_offset = random.uniform(-15.0, 15.0)
            y_offset = random.uniform(-15.0, 15.0)
            
            worker = WorkerModel(
                id=w_id,
                name=name,
                role=role,
                current_node=start_node_id,
                x=node_coords["x"] + x_offset,
                y=node_coords["y"] + y_offset,
                destination=random.choice([1, 6]), # Evacuation exits
                status="Safe",
                color=color
            )
            db_workers.append(worker)
            
        db.add_all(db_workers)
        db.commit()
        print(f"[SafeGuard Seeder] Seed completed successfully. Database fully operational.")
    except Exception as e:
        db.rollback()
        print(f"[SafeGuard Seeder] Error during seeding: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
