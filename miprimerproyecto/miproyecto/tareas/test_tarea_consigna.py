"""Tests de evaluacion de la consigna.

Consigna: "Crea una app 'tareas' con nombre, descripcion y fecha.
Carga 3 tareas desde el admin y muestralas en la portada."
"""
from django.test import TestCase
from django.contrib import admin

from .models import Tarea


class ModeloTareaTests(TestCase):
    def test_tiene_campos_requeridos(self):
        campos = [f.name for f in Tarea._meta.get_fields()]
        for campo in ('name', 'description', 'date'):
            self.assertIn(campo, campos)

    def test_crea_y_muestra_nombre(self):
        tarea = Tarea.objects.create(
            name='Comprar pan',
            description='Ir a la panaderia',
        )
        self.assertEqual(str(tarea), 'Comprar pan')


class AdminTests(TestCase):
    def test_modelo_registrado_en_admin(self):
        self.assertIn(Tarea, admin.site._registry)


class PortadaTests(TestCase):
    def test_portada_muestra_tarea(self):
        Tarea.objects.create(
            name='Comprar pan',
            description='Ir a la panaderia',
        )
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Comprar pan')
        self.assertContains(response, 'Ir a la panaderia')
