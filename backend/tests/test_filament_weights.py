import os
import unittest

os.environ.setdefault('SECRET_KEY', 'test-only')
os.environ.setdefault('ADMIN_USERNAME', 'test')
os.environ.setdefault('ADMIN_PASSWORD_HASH', 'test-only')

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app import crud, schemas
from app.database import Base
from app.routers.filaments import update_filament


class FilamentWeightsTest(unittest.TestCase):
    def test_create_weight_boundaries(self):
        for remaining in (0, 1000):
            schemas.FilamentCreate(material='PLA', color='White', weight_total_g=1000, weight_remaining_g=remaining)
        with self.assertRaises(ValidationError):
            schemas.FilamentCreate(material='PLA', color='White', weight_total_g=1000, weight_remaining_g=1001)

    def test_partial_updates_validate_result_before_saving(self):
        engine = create_engine('sqlite://')
        self.addCleanup(engine.dispose)
        Base.metadata.create_all(engine)
        with Session(engine) as db:
            spool = crud.create_filament(db, schemas.FilamentCreate(
                material='PLA', color='White', weight_total_g=1000, weight_remaining_g=800))
            for values in (
                {'weight_remaining_g': 1001},
                {'weight_total_g': 799},
                {'weight_total_g': 500, 'weight_remaining_g': 501},
            ):
                with self.subTest(values=values), self.assertRaises(HTTPException) as error:
                    update_filament(spool.id, schemas.FilamentUpdate(**values), db)
                self.assertEqual(error.exception.status_code, 422)
                db.refresh(spool)
                self.assertEqual((spool.weight_total_g, spool.weight_remaining_g), (1000, 800))
            for values in (
                {'weight_remaining_g': 1000},
                {'weight_total_g': 500, 'weight_remaining_g': 500},
                {'weight_remaining_g': 0},
            ):
                update_filament(spool.id, schemas.FilamentUpdate(**values), db)
                self.assertLessEqual(spool.weight_remaining_g, spool.weight_total_g)

    def test_explicit_null_weights_rejected(self):
        for field in ('weight_total_g', 'weight_remaining_g'):
            with self.subTest(field=field), self.assertRaises(ValidationError):
                schemas.FilamentUpdate(**{field: None})
