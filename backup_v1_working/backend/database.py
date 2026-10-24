"""
SMARTTWIN AI - Database Module
SQLite persistence for sensor readings, ML predictions, alerts, and maintenance history.
Features auto-migration, event-driven alert lifecycle deduplication, and demo labeling.
"""

import os
import sqlite3
import json
from datetime import datetime
from typing import List, Dict, Any, Optional

DB_FILENAME = "smarttwin.db"


def get_db_path() -> str:
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    return os.path.join(root, DB_FILENAME)


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    return conn


def _migrate_schema(conn: sqlite3.Connection):
    """Safely upgrades existing schema without dropping user tables or losing data."""
    cursor = conn.cursor()

    # 1. Migrate alerts table
    cursor.execute("PRAGMA table_info(alerts);")
    alert_cols = [row["name"] for row in cursor.fetchall()]

    if "is_active" not in alert_cols:
        cursor.execute("ALTER TABLE alerts ADD COLUMN is_active INTEGER DEFAULT 1;")
    if "last_seen_at" not in alert_cols:
        cursor.execute("ALTER TABLE alerts ADD COLUMN last_seen_at TEXT;")
    if "resolved_at" not in alert_cols:
        cursor.execute("ALTER TABLE alerts ADD COLUMN resolved_at TEXT;")
    if "occurrence_count" not in alert_cols:
        cursor.execute("ALTER TABLE alerts ADD COLUMN occurrence_count INTEGER DEFAULT 1;")

    # 2. Migrate maintenance_events table
    cursor.execute("PRAGMA table_info(maintenance_events);")
    maint_cols = [row["name"] for row in cursor.fetchall()]

    if "is_demo" not in maint_cols:
        cursor.execute("ALTER TABLE maintenance_events ADD COLUMN is_demo INTEGER DEFAULT 0;")

    conn.commit()


def init_db():
    """Initializes SQLite schema, runs migrations, and creates indexes."""
    conn = get_connection()
    cursor = conn.cursor()

    # 1. Sensor Readings
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sensor_readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        machine_type TEXT DEFAULT 'M',
        air_temperature_k REAL,
        air_temperature_c REAL,
        process_temperature_k REAL,
        process_temperature_c REAL,
        rotational_speed REAL,
        torque REAL,
        tool_wear REAL,
        vibration REAL,
        health_score REAL,
        operating_mode TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_readings_time ON sensor_readings(timestamp);")

    # 2. Predictions
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS predictions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        machine_type TEXT,
        air_temperature_k REAL,
        process_temperature_k REAL,
        rotational_speed REAL,
        torque REAL,
        tool_wear REAL,
        failure_predicted INTEGER,
        failure_probability REAL,
        health_status TEXT,
        recommendation TEXT,
        source TEXT DEFAULT 'MANUAL',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_pred_time ON predictions(timestamp);")

    # 3. Alerts
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        severity TEXT NOT NULL, -- 'CRITICAL', 'WARNING', 'INFO'
        alert_type TEXT NOT NULL,
        message TEXT NOT NULL,
        source TEXT NOT NULL, -- 'ML_MODEL' or 'RULE_THRESHOLD'
        reading_snapshot TEXT,
        acknowledged INTEGER DEFAULT 0,
        acknowledged_at TEXT,
        is_active INTEGER DEFAULT 1,
        last_seen_at TEXT,
        resolved_at TEXT,
        occurrence_count INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)
    # 4. Maintenance Events
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS maintenance_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        technician_name TEXT NOT NULL,
        action_type TEXT NOT NULL,
        component TEXT NOT NULL,
        description TEXT NOT NULL,
        notes TEXT,
        is_demo INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)

    conn.commit()

    # Run safe column migrations BEFORE creating indexes on new columns
    _migrate_schema(conn)

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_alerts_ack ON alerts(acknowledged, severity);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_alerts_time ON alerts(timestamp);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts(is_active, alert_type);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_maint_time ON maintenance_events(timestamp);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_maint_demo ON maintenance_events(is_demo);")

    conn.commit()

    # Seed baseline demo records if empty
    _seed_initial_demo_records(conn)

    conn.close()


def _seed_initial_demo_records(conn: sqlite3.Connection):
    cursor = conn.cursor()

    # Check maintenance events count
    cursor.execute("SELECT COUNT(*) FROM maintenance_events;")
    if cursor.fetchone()[0] == 0:
        demo_events = [
            (
                "2026-10-20 09:30:00",
                "Er. Alex Bennett (Plant Lead)",
                "CALIBRATION",
                "SPINDLE_BEARING",
                "[DEMO RECORD] Calibrated spindle balance and bearing acoustic transducers after 500 operating hours.",
                "Verified dynamic run-out < 3 microns.",
                1
            ),
            (
                "2026-10-21 14:15:00",
                "K. Sharma (Maintenance Eng.)",
                "TOOL_REPLACEMENT",
                "CUTTING_TOOL",
                "[DEMO RECORD] Replaced TiAlN coated carbide insert (Tool #4) due to flank wear reaching 215 min.",
                "Installed new Sandvik CNMG insert, zeroed tool wear offset.",
                1
            ),
            (
                "2026-10-22 11:00:00",
                "P. Nair (Service Tech)",
                "LUBRICATION",
                "COOLING_SYSTEM",
                "[DEMO RECORD] Flushed coolant fluid and cleared particulate buildup from radiator cooling fins.",
                "Fluid conductivity and coolant pH (8.8) within factory spec.",
                1
            )
        ]
        cursor.executemany("""
            INSERT INTO maintenance_events (timestamp, technician_name, action_type, component, description, notes, is_demo)
            VALUES (?, ?, ?, ?, ?, ?, ?);
        """, demo_events)

    # Check alerts count
    cursor.execute("SELECT COUNT(*) FROM alerts;")
    if cursor.fetchone()[0] == 0:
        demo_alerts = [
            (
                "2026-10-22 10:45:00",
                "WARNING",
                "THERMAL_WARNING",
                "[DEMO EVENT] Coolant radiator heat exchange delta dropped below 8.0 K.",
                "RULE_THRESHOLD",
                json.dumps({"air_temp_k": 301.2, "proc_temp_k": 308.1, "rpm": 1390}),
                1,
                "2026-10-22 11:05:00",
                0,
                "2026-10-22 10:45:00",
                "2026-10-22 11:10:00",
                1
            ),
            (
                "2026-10-21 14:02:00",
                "CRITICAL",
                "ML_FAILURE_RISK",
                "[DEMO EVENT] AI Model predicted 84% failure probability due to cutting tool overstrain.",
                "ML_MODEL",
                json.dumps({"tool_wear_min": 218.0, "torque_nm": 65.4, "predicted_mode": "TWF"}),
                1,
                "2026-10-21 14:10:00",
                0,
                "2026-10-21 14:02:00",
                "2026-10-21 14:15:00",
                1
            )
        ]
        cursor.executemany("""
            INSERT INTO alerts (timestamp, severity, alert_type, message, source, reading_snapshot, acknowledged, acknowledged_at, is_active, last_seen_at, resolved_at, occurrence_count)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, demo_alerts)

    conn.commit()


# ==============================================================================
# SENSOR READINGS REPOSITORY
# ==============================================================================

def save_sensor_reading(reading: Dict[str, Any]) -> int:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO sensor_readings (
            timestamp, machine_type, air_temperature_k, air_temperature_c,
            process_temperature_k, process_temperature_c, rotational_speed,
            torque, tool_wear, vibration, health_score, operating_mode
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, (
        reading.get("timestamp", datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
        reading.get("machine_type", "M"),
        reading.get("air_temperature_k"),
        reading.get("air_temperature_c"),
        reading.get("process_temperature_k"),
        reading.get("process_temperature_c"),
        reading.get("rotational_speed"),
        reading.get("torque"),
        reading.get("tool_wear"),
        reading.get("vibration"),
        reading.get("health_score"),
        reading.get("operating_mode", "normal")
    ))
    reading_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return reading_id


def get_recent_sensor_readings(limit: int = 50) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM sensor_readings
        ORDER BY id DESC LIMIT ?;
    """, (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in reversed(rows)]


# ==============================================================================
# PREDICTIONS REPOSITORY
# ==============================================================================

def save_prediction(pred: Dict[str, Any]) -> int:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO predictions (
            timestamp, machine_type, air_temperature_k, process_temperature_k,
            rotational_speed, torque, tool_wear, failure_predicted,
            failure_probability, health_status, recommendation, source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, (
        pred.get("timestamp", datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
        pred.get("machine_type", "M"),
        pred.get("air_temperature_k"),
        pred.get("process_temperature_k"),
        pred.get("rotational_speed"),
        pred.get("torque"),
        pred.get("tool_wear"),
        1 if pred.get("failure_predicted") else 0,
        pred.get("failure_probability", 0.0),
        pred.get("health_status", "OPTIMAL"),
        pred.get("recommendation", ""),
        pred.get("source", "MANUAL")
    ))
    pred_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return pred_id


def get_recent_predictions(limit: int = 20) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM predictions
        ORDER BY id DESC LIMIT ?;
    """, (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ==============================================================================
# ALERTS REPOSITORY (WITH DEDUPLICATION & LIFECYCLE)
# ==============================================================================

def save_alert(
    severity: str,
    alert_type: str,
    message: str,
    source: str,
    reading_snapshot: Optional[dict] = None
) -> int:
    """
    Event-driven alert lifecycle with deduplication:
    - If an active alert of the same alert_type and source exists:
      Updates last_seen_at, updates snapshot, increments occurrence_count,
      and escalates severity if incoming is CRITICAL. Prevents duplicate rows.
    - If no active alert exists:
      Inserts a new active alert record.
    """
    conn = get_connection()
    cursor = conn.cursor()
    snapshot_str = json.dumps(reading_snapshot) if reading_snapshot else None
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Search for an existing active alert for this event type and source
    cursor.execute("""
        SELECT id, severity, occurrence_count FROM alerts
        WHERE alert_type = ? AND source = ? AND is_active = 1
        ORDER BY id DESC LIMIT 1;
    """, (alert_type, source))
    existing = cursor.fetchone()

    if existing:
        alert_id = existing["id"]
        current_sev = existing["severity"]
        occ_count = (existing["occurrence_count"] or 1) + 1

        # Escalate severity if incoming is more severe
        new_sev = "CRITICAL" if (severity == "CRITICAL" or current_sev == "CRITICAL") else severity

        cursor.execute("""
            UPDATE alerts
            SET last_seen_at = ?,
                occurrence_count = ?,
                reading_snapshot = ?,
                message = ?,
                severity = ?
            WHERE id = ?;
        """, (now_str, occ_count, snapshot_str, message, new_sev, alert_id))
        conn.commit()
        conn.close()
        return alert_id

    # No active alert exists, create a new one
    cursor.execute("""
        INSERT INTO alerts (
            timestamp, severity, alert_type, message, source,
            reading_snapshot, acknowledged, is_active, last_seen_at, occurrence_count
        ) VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?, 1);
    """, (now_str, severity, alert_type, message, source, snapshot_str, now_str))
    alert_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return alert_id


def resolve_alert(alert_type: str, source: str) -> int:
    """Marks an active condition as resolved when readings return to safe parameters."""
    conn = get_connection()
    cursor = conn.cursor()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    cursor.execute("""
        UPDATE alerts
        SET is_active = 0, resolved_at = ?
        WHERE alert_type = ? AND source = ? AND is_active = 1;
    """, (now_str, alert_type, source))
    affected = cursor.rowcount
    conn.commit()
    conn.close()
    return affected


def get_alerts(
    severity: Optional[str] = None,
    acknowledged: Optional[int] = None,
    is_active: Optional[int] = None,
    limit: int = 50
) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM alerts WHERE 1=1"
    params = []

    if severity and severity.upper() != "ALL":
        query += " AND severity = ?"
        params.append(severity.upper())

    if acknowledged is not None:
        query += " AND acknowledged = ?"
        params.append(int(acknowledged))

    if is_active is not None:
        query += " AND is_active = ?"
        params.append(int(is_active))

    query += " ORDER BY id DESC LIMIT ?"
    params.append(limit)

    cursor.execute(query, tuple(params))
    rows = cursor.fetchall()
    conn.close()

    result = []
    for r in rows:
        item = dict(r)
        if item.get("reading_snapshot"):
            try:
                item["reading_snapshot"] = json.loads(item["reading_snapshot"])
            except Exception:
                pass
        result.append(item)
    return result


def acknowledge_alert(alert_id: int) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("""
        UPDATE alerts
        SET acknowledged = 1, acknowledged_at = ?
        WHERE id = ?;
    """, (now_str, alert_id))
    affected = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return affected


# ==============================================================================
# MAINTENANCE EVENTS REPOSITORY
# ==============================================================================

def add_maintenance_event(
    technician_name: str,
    action_type: str,
    component: str,
    description: str,
    notes: Optional[str] = None,
    is_demo: int = 0,
    timestamp: Optional[str] = None
) -> int:
    if not timestamp:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO maintenance_events (timestamp, technician_name, action_type, component, description, notes, is_demo)
        VALUES (?, ?, ?, ?, ?, ?, ?);
    """, (timestamp, technician_name.strip(), action_type.upper().strip(), component.upper().strip(), description.strip(), (notes or "").strip(), int(is_demo)))
    event_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return event_id


def get_maintenance_events(
    component: Optional[str] = None,
    action_type: Optional[str] = None,
    is_demo: Optional[int] = None,
    search: Optional[str] = None,
    limit: int = 100
) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM maintenance_events WHERE 1=1"
    params = []

    if component and component.upper() != "ALL":
        query += " AND component = ?"
        params.append(component.upper())

    if action_type and action_type.upper() != "ALL":
        query += " AND action_type = ?"
        params.append(action_type.upper())

    if is_demo is not None:
        query += " AND is_demo = ?"
        params.append(int(is_demo))

    if search:
        query += " AND (description LIKE ? OR technician_name LIKE ? OR notes LIKE ?)"
        term = f"%{search}%"
        params.extend([term, term, term])

    query += " ORDER BY id DESC LIMIT ?"
    params.append(limit)

    cursor.execute(query, tuple(params))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def export_history_to_csv(is_demo: Optional[int] = None) -> str:
    """Exports maintenance records to a properly formatted CSV string."""
    conn = get_connection()
    cursor = conn.cursor()

    query = """
        SELECT id, timestamp, technician_name, action_type, component, description, notes, is_demo
        FROM maintenance_events WHERE 1=1
    """
    params = []
    if is_demo is not None:
        query += " AND is_demo = ?"
        params.append(int(is_demo))

    query += " ORDER BY id DESC;"
    cursor.execute(query, tuple(params))
    rows = cursor.fetchall()
    conn.close()

    lines = ["ID,Timestamp,Technician,Action Type,Component,Description,Notes,Record Type"]
    for r in rows:
        clean_desc = str(r["description"]).replace('"', '""')
        clean_notes = str(r["notes"] or "").replace('"', '""')
        rec_type = "DEMO RECORD" if r["is_demo"] == 1 else "USER LOG"
        lines.append(f'{r["id"]},"{r["timestamp"]}","{r["technician_name"]}","{r["action_type"]}","{r["component"]}","{clean_desc}","{clean_notes}","{rec_type}"')

    return "\n".join(lines)


# Initialize DB on module import
init_db()
