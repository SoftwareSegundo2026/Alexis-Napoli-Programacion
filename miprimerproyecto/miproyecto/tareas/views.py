from django.shortcuts import render
from .models import Tarea

def lista(request):
    tareas = Tarea.objects.filter(is_deleted=False)
    return render(request, 'tareas/lista.html', {'tareas': tareas})