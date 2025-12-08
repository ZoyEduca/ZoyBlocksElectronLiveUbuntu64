# -*- mode: python ; coding: utf-8 -*-

import sys
import os

# Caminho ABSOLUTO do site-packages do venv (fora da pasta python/)
site_packages = os.path.abspath(
    os.path.join('..', '..', 'venv', 'Lib', 'site-packages')
)

block_cipher = None

a = Analysis(
    ['vision.py'],
    pathex=[os.path.abspath('.')],   # agora estamos dentro de python/zoy_vision/
    binaries=[],
    datas=[
        (os.path.join(site_packages, 'serial'), 'serial'),
        (os.path.join(site_packages, 'serial/tools'), 'serial/tools'),
        (os.path.join(site_packages, 'serial/urlhandler'), 'serial/urlhandler'),
        (os.path.join(site_packages, 'cv2'), 'cv2'),
        (os.path.join(site_packages, 'numpy'), 'numpy'),
    ],
    hiddenimports=[
        'serial',
        'serial.tools',
        'serial.tools.list_ports',
        'serial.urlhandler',
        'serial.win32',
        'serial.serialwin32',
        'cv2',
        'cv2.data',
        'numpy',
        'numpy.core._dtype',
        'numpy.core._methods',
        'numpy.core._exceptions',
    ],
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='vision',
    debug=False,
    console=True,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    name='vision',
)
