"""
Pytest configuration and fixtures for SmartTwin AI test suite.
Provides an isolated, writable temporary SQLite database for all tests,
ensuring the user's production smarttwin.db is never modified or locked during test runs.
"""

import os
import tempfile
import shutil
import pytest

# Module-level setup: initialize isolated test database in writable temp directory
_TEST_TEMP_DIR = tempfile.mkdtemp(prefix="smarttwin_test_")
_TEST_DB_PATH = os.path.join(_TEST_TEMP_DIR, "isolated_test_smarttwin.db")
os.environ["SMARTTWIN_DB_PATH"] = _TEST_DB_PATH

# Initialize complete database schema, migrations, and demo data in the isolated test DB
from backend.database import init_db
init_db(_TEST_DB_PATH)


def pytest_unconfigure(config):
    """
    Called after all tests complete.
    Cleans up the temporary database file and directory, and unsets SMARTTWIN_DB_PATH.
    """
    global _TEST_TEMP_DIR, _TEST_DB_PATH
    os.environ.pop("SMARTTWIN_DB_PATH", None)
    if _TEST_TEMP_DIR and os.path.exists(_TEST_TEMP_DIR):
        shutil.rmtree(_TEST_TEMP_DIR, ignore_errors=True)


@pytest.fixture(scope="session", autouse=True)
def isolated_test_database():
    """
    Session-wide fixture ensuring that SMARTTWIN_DB_PATH points to the
    isolated test database and NOT the production smarttwin.db.
    """
    prod_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "smarttwin.db"))
    active_path = os.path.abspath(os.environ.get("SMARTTWIN_DB_PATH", ""))

    assert active_path != "", "SMARTTWIN_DB_PATH must be set for automated test isolation"
    assert active_path != prod_path, f"Tests must NOT run against production DB: {prod_path}"
    assert os.path.exists(active_path), f"Isolated test database file does not exist: {active_path}"

    yield active_path
