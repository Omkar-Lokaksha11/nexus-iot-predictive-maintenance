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
    """
    Returns the active SQLite database path.
    Prioritizes SMARTTWIN_DB_PATH environment variable if defined,
    falling back to the standard production smarttwin.db in the project root.
    """
    env_path = os.environ.get("SMARTTWIN_DB_PATH")
    if env_path and env_path.strip():
        return os.path.abspath(env_path.strip())
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    return os.path.join(root, DB_FILENAME)


def get_connection(db_path: Optional[str] = None) -> sqlite3.Connection:
    target_path = db_path or get_db_path()
    target_dir = os.path.dirname(os.path.abspath(target_path))
    if target_dir and not os.path.exists(target_dir):
        os.makedirs(target_dir, exist_ok=True)
    conn = sqlite3.connect(target_path, timeout=15.0)
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
    if "is_test" not in alert_cols:
        cursor.execute("ALTER TABLE alerts ADD COLUMN is_test INTEGER DEFAULT 0;")
    if "is_demo" not in alert_cols:
        cursor.execute("ALTER TABLE alerts ADD COLUMN is_demo INTEGER DEFAULT 0;")

    # Additional workflow and team assignment columns
    if "status" not in alert_cols:
        cursor.execute("ALTER TABLE alerts ADD COLUMN status TEXT DEFAULT 'NEW';")
    if "priority" not in alert_cols:
        cursor.execute("ALTER TABLE alerts ADD COLUMN priority TEXT DEFAULT 'MEDIUM';")
    if "assigned_team" not in alert_cols:
        cursor.execute("ALTER TABLE alerts ADD COLUMN assigned_team TEXT;")
    if "assigned_person" not in alert_cols:
        cursor.execute("ALTER TABLE alerts ADD COLUMN assigned_person TEXT;")
    if "assignment_notes" not in alert_cols:
        cursor.execute("ALTER TABLE alerts ADD COLUMN assignment_notes TEXT;")
    if "assigned_at" not in alert_cols:
        cursor.execute("ALTER TABLE alerts ADD COLUMN assigned_at TEXT;")
    if "resolution_notes" not in alert_cols:
        cursor.execute("ALTER TABLE alerts ADD COLUMN resolution_notes TEXT;")
    if "resolved_by" not in alert_cols:
        cursor.execute("ALTER TABLE alerts ADD COLUMN resolved_by TEXT;")
    if "resolution_category" not in alert_cols:
        cursor.execute("ALTER TABLE alerts ADD COLUMN resolution_category TEXT;")

    # Populate status and priority defaults for existing records
    cursor.execute("UPDATE alerts SET status = 'RESOLVED' WHERE (status IS NULL OR status = 'NEW') AND is_active = 0;")
    cursor.execute("UPDATE alerts SET status = 'ASSIGNED' WHERE (status IS NULL OR status = 'NEW') AND acknowledged = 1 AND is_active = 1;")
    cursor.execute("UPDATE alerts SET status = 'NEW' WHERE status IS NULL;")
    cursor.execute("UPDATE alerts SET priority = 'HIGH' WHERE (priority IS NULL OR priority = '') AND severity = 'CRITICAL';")
    cursor.execute("UPDATE alerts SET priority = 'MEDIUM' WHERE (priority IS NULL OR priority = '') AND severity = 'WARNING';")
    cursor.execute("UPDATE alerts SET priority = 'LOW' WHERE (priority IS NULL OR priority = '') AND severity = 'INFO';")

    # Cleanly isolate existing test-generated records and tag seed demo records
    cursor.execute("UPDATE alerts SET is_test = 1, is_active = 0 WHERE alert_type LIKE 'TEST_%';")
    cursor.execute("UPDATE alerts SET is_demo = 1 WHERE message LIKE '[DEMO%' OR alert_type LIKE 'DEMO%';")

    # 2. Migrate maintenance_events table
    cursor.execute("PRAGMA table_info(maintenance_events);")
    maint_cols = [row["name"] for row in cursor.fetchall()]

    if "is_demo" not in maint_cols:
        cursor.execute("ALTER TABLE maintenance_events ADD COLUMN is_demo INTEGER DEFAULT 0;")

    # 3. Create alert_actions audit trail table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS alert_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        alert_id INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        action_type TEXT NOT NULL,
        performed_by TEXT NOT NULL,
        status_after TEXT,
        details TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(alert_id) REFERENCES alerts(id) ON DELETE CASCADE
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_alert_actions_alert ON alert_actions(alert_id);")

    # 4. Backfill initial alert_actions if table is empty
    cursor.execute("SELECT COUNT(*) FROM alert_actions;")
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
            INSERT INTO alert_actions (alert_id, timestamp, action_type, performed_by, status_after, details, notes)
            SELECT id, timestamp, 'CREATED', 'MachineSimulator', status,
                   'Incident condition logged: ' || message, 'Automated condition detection'
            FROM alerts;
        """)
        cursor.execute("""
            INSERT INTO alert_actions (alert_id, timestamp, action_type, performed_by, status_after, details, notes)
            SELECT id, COALESCE(acknowledged_at, timestamp), 'ACKNOWLEDGED', 'Plant Operator', status,
                   'Incident acknowledged by operator', ''
            FROM alerts WHERE acknowledged = 1;
        """)
        cursor.execute("""
            INSERT INTO alert_actions (alert_id, timestamp, action_type, performed_by, status_after, details, notes)
            SELECT id, COALESCE(resolved_at, timestamp), 'RESOLVED', 'Maintenance Lead', 'RESOLVED',
                   'Operating parameters restored to safe nominal baseline', ''
            FROM alerts WHERE is_active = 0;
        """)

    conn.commit()


def init_db(db_path: Optional[str] = None):
    """Initializes SQLite schema, runs migrations, and creates indexes."""
    conn = get_connection(db_path)
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
    reading_snapshot: Optional[dict] = None,
    is_test: Optional[int] = None,
    is_demo: Optional[int] = None
) -> int:
    """
    Saves an alert to the database with safety, classification and deduplication:
    - Automatically flags test alerts if alert_type starts with TEST_.
    - Automatically flags demo events if message starts with [DEMO.
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

    if is_test is None:
        is_test = 1 if alert_type.upper().startswith("TEST_") else 0
    if is_demo is None:
        is_demo = 1 if (message.startswith("[DEMO") or alert_type.upper().startswith("DEMO_")) else 0

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
                severity = ?,
                is_test = ?,
                is_demo = ?
            WHERE id = ?;
        """, (now_str, occ_count, snapshot_str, message, new_sev, is_test, is_demo, alert_id))
        conn.commit()
        conn.close()
        return alert_id

    # No active alert exists, create a new one
    priority = "HIGH" if severity == "CRITICAL" else ("MEDIUM" if severity == "WARNING" else "LOW")
    cursor.execute("""
        INSERT INTO alerts (
            timestamp, severity, alert_type, message, source,
            reading_snapshot, acknowledged, is_active, last_seen_at, occurrence_count, is_test, is_demo,
            status, priority
        ) VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?, 1, ?, ?, 'NEW', ?);
    """, (now_str, severity, alert_type, message, source, snapshot_str, now_str, is_test, is_demo, priority))
    alert_id = cursor.lastrowid

    # Record CREATED event in alert_actions
    cursor.execute("""
        INSERT INTO alert_actions (alert_id, timestamp, action_type, performed_by, status_after, details, notes)
        VALUES (?, ?, 'CREATED', 'MachineSimulator', 'NEW', ?, 'System generated telemetry event');
    """, (alert_id, now_str, f"Incident logged: {message}"))

    conn.commit()
    conn.close()
    return alert_id


def resolve_alert(alert_type: str, source: str) -> int:
    """Marks an active condition as resolved when readings return to safe parameters."""
    conn = get_connection()
    cursor = conn.cursor()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    cursor.execute("""
        SELECT id FROM alerts
        WHERE alert_type = ? AND source = ? AND is_active = 1;
    """, (alert_type, source))
    active_ids = [row["id"] for row in cursor.fetchall()]

    cursor.execute("""
        UPDATE alerts
        SET is_active = 0, resolved_at = ?, status = 'RESOLVED'
        WHERE alert_type = ? AND source = ? AND is_active = 1;
    """, (now_str, alert_type, source))
    affected = cursor.rowcount

    for aid in active_ids:
        cursor.execute("""
            INSERT INTO alert_actions (alert_id, timestamp, action_type, performed_by, status_after, details, notes)
            VALUES (?, ?, 'RESOLVED', 'MachineSimulator', 'RESOLVED', 'Condition returned to safe operational bounds', 'Automatic simulator state resolution');
        """, (aid, now_str))

    conn.commit()
    conn.close()
    return affected


def get_alerts(
    severity: Optional[str] = None,
    status: Optional[str] = None,
    assigned: Optional[str] = None,
    team: Optional[str] = None,
    search: Optional[str] = None,
    acknowledged: Optional[int] = None,
    is_active: Optional[int] = None,
    limit: int = 50,
    include_test: bool = False
) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM alerts WHERE 1=1"
    params = []

    if not include_test:
        query += " AND (is_test = 0 OR is_test IS NULL)"

    if severity and severity.upper() != "ALL":
        query += " AND severity = ?"
        params.append(severity.upper())

    if status and status.upper() != "ALL":
        query += " AND status = ?"
        params.append(status.upper())

    if assigned:
        if assigned.upper() == "ASSIGNED":
            query += " AND (assigned_team IS NOT NULL AND assigned_team != '')"
        elif assigned.upper() == "UNASSIGNED":
            query += " AND (assigned_team IS NULL OR assigned_team = '')"

    if team and team.upper() != "ALL":
        query += " AND assigned_team = ?"
        params.append(team)

    if search and search.strip():
        term = f"%{search.strip()}%"
        query += " AND (message LIKE ? OR alert_type LIKE ? OR assigned_person LIKE ? OR assigned_team LIKE ?)"
        params.extend([term, term, term, term])

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


def get_alert_summary(include_test: bool = False) -> Dict[str, int]:
    """Returns high-level statistics for the alert management center."""
    conn = get_connection()
    cursor = conn.cursor()
    test_filter = "WHERE (is_test = 0 OR is_test IS NULL)" if not include_test else "WHERE 1=1"

    cursor.execute(f"SELECT COUNT(*) FROM alerts {test_filter};")
    total = cursor.fetchone()[0]

    cursor.execute(f"SELECT COUNT(*) FROM alerts {test_filter} AND is_active = 1 AND severity = 'CRITICAL';")
    active_critical = cursor.fetchone()[0]

    cursor.execute(f"SELECT COUNT(*) FROM alerts {test_filter} AND is_active = 1 AND severity = 'WARNING';")
    active_warning = cursor.fetchone()[0]

    cursor.execute(f"SELECT COUNT(*) FROM alerts {test_filter} AND (status = 'RESOLVED' OR is_active = 0);")
    resolved = cursor.fetchone()[0]

    cursor.execute(f"SELECT COUNT(*) FROM alerts {test_filter} AND (status = 'NEW' OR (status IS NULL AND acknowledged = 0 AND is_active = 1));")
    new_alerts = cursor.fetchone()[0]

    cursor.execute(f"SELECT COUNT(*) FROM alerts {test_filter} AND status = 'ASSIGNED';")
    assigned_alerts = cursor.fetchone()[0]

    cursor.execute(f"SELECT COUNT(*) FROM alerts {test_filter} AND status = 'IN_PROGRESS';")
    in_progress_alerts = cursor.fetchone()[0]

    cursor.execute(f"SELECT COUNT(*) FROM alerts {test_filter} AND acknowledged = 0 AND is_active = 1;")
    unacknowledged = cursor.fetchone()[0]

    conn.close()
    return {
        "total": total,
        "active_critical": active_critical,
        "active_warning": active_warning,
        "resolved": resolved,
        "unacknowledged": unacknowledged,
        "new_alerts": new_alerts,
        "assigned_alerts": assigned_alerts,
        "in_progress_alerts": in_progress_alerts
    }


def acknowledge_alert(alert_id: int) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("""
        UPDATE alerts
        SET acknowledged = 1, acknowledged_at = ?,
            status = CASE WHEN status = 'NEW' THEN 'ASSIGNED' ELSE status END
        WHERE id = ?;
    """, (now_str, alert_id))
    affected = cursor.rowcount > 0
    if affected:
        cursor.execute("""
            INSERT INTO alert_actions (alert_id, timestamp, action_type, performed_by, status_after, details, notes)
            VALUES (?, ?, 'ACKNOWLEDGED', 'Operator', (SELECT status FROM alerts WHERE id = ?), 'Alert acknowledged by operator', '');
        """, (alert_id, now_str, alert_id))
    conn.commit()
    conn.close()
    return affected


def get_alert_by_id(alert_id: int) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM alerts WHERE id = ?;", (alert_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return None

    item = dict(row)
    if item.get("reading_snapshot"):
        try:
            item["reading_snapshot"] = json.loads(item["reading_snapshot"])
        except Exception:
            pass

    cursor.execute("""
        SELECT * FROM alert_actions
        WHERE alert_id = ?
        ORDER BY id ASC;
    """, (alert_id,))
    history_rows = cursor.fetchall()
    item["history"] = [dict(h) for h in history_rows]

    conn.close()
    return item


def get_alert_history(alert_id: int) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM alert_actions
        WHERE alert_id = ?
        ORDER BY id ASC;
    """, (alert_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def assign_alert(
    alert_id: int,
    assigned_team: str,
    assigned_person: str,
    priority: str = "MEDIUM",
    notes: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    clean_team = (assigned_team or "").strip()
    clean_person = (assigned_person or "").strip()
    clean_priority = (priority or "MEDIUM").upper().strip()
    clean_notes = (notes or "").strip()

    cursor.execute("""
        UPDATE alerts
        SET assigned_team = ?,
            assigned_person = ?,
            priority = ?,
            assignment_notes = ?,
            assigned_at = ?,
            status = CASE WHEN status = 'NEW' THEN 'ASSIGNED' ELSE status END
        WHERE id = ?;
    """, (clean_team, clean_person, clean_priority, clean_notes, now_str, alert_id))

    if cursor.rowcount == 0:
        conn.close()
        return None

    cursor.execute("SELECT status FROM alerts WHERE id = ?;", (alert_id,))
    status_row = cursor.fetchone()
    status_after = status_row["status"] if status_row else "ASSIGNED"

    cursor.execute("""
        INSERT INTO alert_actions (alert_id, timestamp, action_type, performed_by, status_after, details, notes)
        VALUES (?, ?, 'ASSIGNED', ?, ?, ?, ?);
    """, (
        alert_id,
        now_str,
        clean_person or "Plant Supervisor",
        status_after,
        f"Assigned to {clean_team} ({clean_person}) with {clean_priority} priority.",
        clean_notes
    ))

    conn.commit()
    conn.close()
    return get_alert_by_id(alert_id)


def update_alert_status(
    alert_id: int,
    new_status: str,
    performed_by: str = "Plant Operator",
    notes: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    valid_statuses = ["NEW", "ASSIGNED", "IN_PROGRESS", "RESOLVED"]
    clean_status = (new_status or "").upper().strip()
    if clean_status not in valid_statuses:
        raise ValueError(f"Invalid status '{new_status}'. Allowed statuses are: {', '.join(valid_statuses)}")

    conn = get_connection()
    cursor = conn.cursor()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    resolved_at = now_str if clean_status == "RESOLVED" else None

    if clean_status == "RESOLVED":
        cursor.execute("""
            UPDATE alerts
            SET status = ?, is_active = 0, resolved_at = ?
            WHERE id = ?;
        """, (clean_status, resolved_at, alert_id))
    else:
        cursor.execute("""
            UPDATE alerts
            SET status = ?, is_active = 1
            WHERE id = ?;
        """, (clean_status, alert_id))

    if cursor.rowcount == 0:
        conn.close()
        return None

    clean_performed_by = (performed_by or "Plant Operator").strip()
    clean_notes = (notes or "").strip()

    cursor.execute("""
        INSERT INTO alert_actions (alert_id, timestamp, action_type, performed_by, status_after, details, notes)
        VALUES (?, ?, 'STATUS_CHANGE', ?, ?, ?, ?);
    """, (
        alert_id,
        now_str,
        clean_performed_by,
        clean_status,
        f"Status changed to {clean_status}.",
        clean_notes
    ))

    conn.commit()
    conn.close()
    return get_alert_by_id(alert_id)


def record_alert_action(
    alert_id: int,
    action_performed: str,
    diagnosis: Optional[str],
    technician_notes: str,
    performed_by: str,
    status_after: Optional[str] = "IN_PROGRESS"
) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    clean_action = (action_performed or "").strip()
    clean_diagnosis = (diagnosis or "").strip()
    clean_notes = (technician_notes or "").strip()
    clean_by = (performed_by or "Technician").strip()
    clean_status = (status_after or "IN_PROGRESS").upper().strip()

    cursor.execute("""
        UPDATE alerts
        SET status = ?
        WHERE id = ?;
    """, (clean_status, alert_id))

    if cursor.rowcount == 0:
        conn.close()
        return None

    diag_text = f" Diagnosis: {clean_diagnosis}" if clean_diagnosis else ""
    cursor.execute("""
        INSERT INTO alert_actions (alert_id, timestamp, action_type, performed_by, status_after, details, notes)
        VALUES (?, ?, 'ACTION_TAKEN', ?, ?, ?, ?);
    """, (
        alert_id,
        now_str,
        clean_by,
        clean_status,
        f"Action: {clean_action}.{diag_text}",
        clean_notes
    ))

    conn.commit()
    conn.close()
    return get_alert_by_id(alert_id)


def resolve_alert_record(
    alert_id: int,
    resolution_notes: str,
    resolution_category: str,
    resolved_by: str,
    follow_up: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    if not resolution_notes or not resolution_notes.strip():
        raise ValueError("Resolution notes are mandatory when resolving an incident.")
    if not resolved_by or not resolved_by.strip():
        raise ValueError("Resolved by (technician name) is mandatory.")

    conn = get_connection()
    cursor = conn.cursor()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    clean_notes = resolution_notes.strip()
    clean_cat = (resolution_category or "MAINTENANCE_RESOLUTION").upper().strip()
    clean_by = resolved_by.strip()
    clean_followup = (follow_up or "").strip()

    cursor.execute("""
        UPDATE alerts
        SET status = 'RESOLVED',
            is_active = 0,
            resolved_at = ?,
            resolution_notes = ?,
            resolution_category = ?,
            resolved_by = ?
        WHERE id = ?;
    """, (now_str, clean_notes, clean_cat, clean_by, alert_id))

    if cursor.rowcount == 0:
        conn.close()
        return None

    cursor.execute("""
        INSERT INTO alert_actions (alert_id, timestamp, action_type, performed_by, status_after, details, notes)
        VALUES (?, ?, 'RESOLVED', ?, 'RESOLVED', ?, ?);
    """, (
        alert_id,
        now_str,
        clean_by,
        f"Incident resolved [{clean_cat}]: {clean_notes}",
        clean_followup
    ))

    conn.commit()
    conn.close()
    return get_alert_by_id(alert_id)


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
