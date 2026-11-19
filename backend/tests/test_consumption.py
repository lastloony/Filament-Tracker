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
from app.routers.filaments import consume_all_filament, consume_filament
from app.routers.stats import overview, overview_by_brand

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
            self.assertEqual(overview(db=db).by_material_color, [])
            with self.assertRaises(HTTPException):
                consume(1)
            with self.assertRaises(HTTPException) as error:
                consume_filament(999, schemas.FilamentConsume(weight_used_g=1), db)
            self.assertEqual(error.exception.status_code, 404)
        engine.dispose()

    def test_consume_all_excludes_empty_spools_from_inventory(self):
        engine = create_engine('sqlite://')
        self.addCleanup(engine.dispose)
        Base.metadata.create_all(engine)
        with Session(engine) as db:
            spools = [
                crud.create_filament(db, schemas.FilamentCreate(
                    brand=brand, material='PLA', color='White',
                    weight_total_g=1000, weight_remaining_g=weight, price=900, currency='RUB',
                ))
                for brand, weight in [('A', 100), ('A', 50), ('B', 30)]
            ]
            for spool in spools[1:]:
                self.assertEqual(consume_all_filament(spool.id, db).weight_remaining_g, 0)

            inventory = overview(db=db)
            self.assertEqual([(row.remaining_g, row.spool_count) for row in inventory.by_material_color], [(100, 1)])
            self.assertEqual([(row.brand, row.spool_count) for row in overview_by_brand('PLA', 'White', db)], [('A', 1)])
            self.assertEqual(inventory.reorder[0].spool_count, 1)

            for _ in range(2):
                self.assertEqual(consume_all_filament(spools[0].id, db).weight_remaining_g, 0)
            self.assertEqual(overview(db=db).by_material_color, [])
            self.assertEqual(overview(db=db).reorder[0].spool_count, 0)
            self.assertEqual(len(crud.list_filaments(db)), 3)
            self.assertEqual(crud.stats_summary(db)[2], [('RUB', 2700)])
            with self.assertRaises(HTTPException) as error:
                consume_all_filament(999, db)
            self.assertEqual(error.exception.status_code, 404)

    def test_invalid_amounts(self):
        for value in [0, -1, 1.5, True, '10']:
            with self.subTest(value=value), self.assertRaises(ValidationError):
                schemas.FilamentConsume(weight_used_g=value)
