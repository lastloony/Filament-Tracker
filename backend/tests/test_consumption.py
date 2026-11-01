import os
import unittest
os.environ.setdefault('SECRET_KEY', 'test-only')
os.environ.setdefault('ADMIN_USERNAME', 'test')
os.environ.setdefault('ADMIN_PASSWORD_HASH', 'test-only')
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app import crud, schemas
from app.database import Base
from app.routers.filaments import consume_filament

class ConsumptionTest(unittest.TestCase):
    def test_consumption(self):
        engine = create_engine('sqlite://')
        Base.metadata.create_all(engine)
        with Session(engine) as db:
            spool = crud.create_filament(db, schemas.FilamentCreate(material='PLA', color='White', weight_total_g=1000, weight_remaining_g=100, price=900, currency='RUB'))
            spool_id = spool.id
            def consume(amount):
                return consume_filament(spool_id, schemas.FilamentConsume(weight_used_g=amount), db)
            self.assertEqual(consume(60).weight_remaining_g, 40)
            with self.assertRaises(HTTPException) as error:
                consume(60)
            self.assertEqual(error.exception.status_code, 409)
            db.refresh(spool)
            self.assertEqual(spool.weight_remaining_g, 40)
            updated = consume(40)
            self.assertEqual(updated.weight_remaining_g, 0)
            self.assertEqual(updated.weight_total_g, 1000)
            self.assertEqual(updated.price, 900)
            self.assertEqual(crud.stats_summary(db)[0], 0)
            with self.assertRaises(HTTPException):
                consume(1)
            with self.assertRaises(HTTPException) as error:
                consume_filament(999, schemas.FilamentConsume(weight_used_g=1), db)
            self.assertEqual(error.exception.status_code, 404)
        engine.dispose()

    def test_invalid_amounts(self):
        for value in [0, -1, 1.5, True, '10']:
            with self.subTest(value=value), self.assertRaises(ValidationError):
                schemas.FilamentConsume(weight_used_g=value)