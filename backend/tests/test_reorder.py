import os
import unittest

os.environ.setdefault('SECRET_KEY', 'test-only')
os.environ.setdefault('ADMIN_USERNAME', 'test')
os.environ.setdefault('ADMIN_PASSWORD_HASH', 'test-only')

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app import crud, schemas
from app.database import Base
from app.routers.stats import overview
from app.routers.settings import disable_reorder, delete_reorder_rule


class ReorderTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://')
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.addCleanup(self.engine.dispose)
        self.addCleanup(self.db.close)

    def spool(self, remaining, brand='A', material='PLA', color='White'):
        return crud.create_filament(self.db, schemas.FilamentCreate(
            brand=brand, material=material, color=color,
            weight_total_g=1000, weight_remaining_g=remaining))

    def rule(self, threshold, brand=None):
        crud.create_reorder_rule(self.db, schemas.ReorderRuleCreate(
            material='PLA', color='White', brand=brand, threshold_g=threshold))

    def test_full_spool_covers_low_spool_across_brands(self):
        self.spool(100)
        self.spool(1000, brand='B')
        self.assertEqual(crud.reorder_candidates(self.db), [])

    def test_same_brand_and_threshold_boundary(self):
        self.spool(100)
        full = self.spool(1000)
        self.assertEqual(crud.reorder_candidates(self.db), [])
        crud.update_filament(self.db, full, schemas.FilamentUpdate(weight_remaining_g=200))
        self.assertEqual(crud.reorder_candidates(self.db), [])
        crud.update_filament(self.db, full, schemas.FilamentUpdate(weight_remaining_g=199))
        result = overview(db=self.db).reorder
        self.assertEqual(len(result), 1)
        self.assertEqual((result[0].remaining_g, result[0].spool_count, result[0].threshold_g), (299, 2, 300))
        self.assertIsNone(result[0].brand)

    def test_other_material_and_color_do_not_cover_shortage(self):
        self.spool(100)
        self.spool(1000, material='PETG')
        self.spool(1000, color='Black')
        result = crud.reorder_candidates(self.db)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].remaining_g, 100)

    def test_general_rule_and_filters(self):
        self.spool(100)
        self.spool(1000, brand='B')
        self.rule(1200)
        result = crud.reorder_candidates(self.db)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].remaining_g, 1100)
        self.assertEqual(result[0].threshold_g, 1200)
        filtered = crud.reorder_candidates(self.db, brand='A', material='PLA', color='White')
        self.assertEqual((filtered[0].brand, filtered[0].remaining_g), ('A', 100))
        self.assertEqual(crud.reorder_candidates(self.db, material='ABS'), [])

    def test_specific_rule_overrides_general_for_brand(self):
        self.spool(100)
        self.spool(100, brand='A')
        self.spool(1000, brand='B')
        self.rule(1000)
        self.rule(250, brand='A')
        result = crud.reorder_candidates(self.db)
        self.assertEqual(len(result), 1)
        self.assertEqual((result[0].brand, result[0].remaining_g, result[0].threshold_g), ('A', 200, 250))

    def test_empty_stock_is_one_group(self):
        self.assertEqual(crud.reorder_candidates(self.db), [])
        self.spool(0)
        self.spool(0)
        result = crud.reorder_candidates(self.db)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].remaining_g, 0)

    def test_disable_persists_and_restore(self):
        self.spool(100)
        self.spool(100, brand='B')
        self.rule(500)
        self.rule(250, brand='A')
        self.assertTrue(crud.reorder_candidates(self.db))
        request = schemas.ReorderDisable(material=' PLA ', color=' White ')
        disabled = disable_reorder(request, self.db)
        rule_id = disabled.id
        self.assertEqual(disable_reorder(request, self.db).id, rule_id)
        self.assertEqual(len(crud.list_reorder_rules(self.db)), 2)
        with Session(self.engine) as other:
            self.assertEqual(crud.reorder_candidates(other), [])
            self.assertEqual(crud.reorder_candidates(other, brand='A'), [])
            self.assertEqual(sum(row.remaining_g for row in overview(db=other).by_material_color), 200)
        delete_reorder_rule(rule_id, self.db)
        self.assertTrue(crud.reorder_candidates(self.db))

    def test_disable_only_selected_material_and_color(self):
        self.spool(100)
        self.spool(100, color='Black')
        self.spool(100, material='PETG')
        disable_reorder(schemas.ReorderDisable(material='PLA', color='White'), self.db)
        result = crud.reorder_candidates(self.db)
        self.assertEqual({(row.material, row.color) for row in result}, {('PLA', 'Black'), ('PETG', 'White')})
