import os
import zipfile
import tempfile
import time
import shutil
import datetime
import json
import season
import git
from season.core.builder.base import Converter

workspace = wiz.workspace("service")
fs = workspace.fs()

def upgrade():
    path = wiz.request.query("path", True)
    info = fs.read.json(os.path.join(path, "portal.json"), dict())
    if 'repo' not in info:
        wiz.response.status(404, True)
    
    cachefs = season.util.os.FileSystem(fs.abspath(".cache"))
    cachefs.remove()
    
    try:
        repo = info['repo']
        downloaded = cachefs.abspath("portal")
        git.Repo.clone_from(repo, downloaded)
    except:
        pass
    
    if cachefs.exists("portal") == False:
        wiz.response.status(404, True)

    fs.remove(path)
    fs.move(cachefs.abspath("portal"), path)
    cachefs.remove()

    build()
    wiz.response.status(200, True)

def list(segment):
    path = wiz.request.query("path", True)
    segment = path.split("/")
    res = []

    if fs.isdir(path):
        if len(segment) == 1:
            files = fs.files(path)
            for name in files:
                fpath = os.path.join(path, name)
                if fs.isdir(fpath) == False:
                    continue
                plugin = fs.read.json(os.path.join(fpath, "portal.json"), dict())
                title = name
                if 'title' in plugin and len(plugin['title']) > 0:
                    title = plugin['title']
                res.append(dict(name=title, path=fpath, type='folder', meta=plugin))
            
            res = sorted(res, key=lambda k: k['name'])
            wiz.response.status(200, res)

        elif len(segment) == 2:
            res.append(dict(name='sample', path=os.path.join(path, 'sample'), type='mod.page'))
            res.append(dict(name='app', path=os.path.join(path, 'app'), type='mod.app', meta=dict(icon="fa-solid fa-layer-group")))
            res.append(dict(name='api', path=os.path.join(path, 'route'), type='mod.route', meta=dict(icon="fa-solid fa-link")))
            res.append(dict(name='libs', path=os.path.join(path, 'libs'), type='mod.libs', meta=dict(icon="fa-solid fa-book")))
            res.append(dict(name='assets', path=os.path.join(path, 'assets'), type='mod.assets', meta=dict(icon="fa-solid fa-images")))
            res.append(dict(name='controller', path=os.path.join(path, 'controller'), type='mod.controller'))
            res.append(dict(name='model', path=os.path.join(path, 'model'), type='mod.model'))
            res.append(dict(name='Package Info', path=os.path.join(path, 'portal.json'), type='file', meta=dict(icon="fa-solid fa-info", editor="info")))
            res.append(dict(name='README', path=os.path.join(path, 'README.md'), type='file'))
            wiz.response.status(200, res)
        
        elif len(segment) == 3:
            mod = segment[2]
            if mod == 'sample':
                mod = 'page'
            
            if mod == 'app' or mod == 'route' or mod == 'page':
                files = fs.files(path)
                for name in files:
                    fpath = os.path.join(path, name)
                    if fs.isfile(os.path.join(fpath, 'app.json')):
                        appinfo = fs.read.json(os.path.join(fpath, 'app.json'))
                        if mod == 'route':
                            res.append(dict(name=appinfo['route'], path=fpath, type=mod, meta=appinfo))
                        else:
                            res.append(dict(name=appinfo['title'], path=fpath, type=mod, meta=appinfo))

                wiz.response.status(200, res)

        elif len(segment) > 3:
            mod = segment[2]
            if mod == 'app' or mod == 'route':
                wiz.response.status(200, res)
 
        files = fs.files(path)
        for name in files:
            fpath = os.path.join(path, name)
            ftype = 'file' if fs.isfile(fpath) else 'folder'
            res.append(dict(name=name, path=fpath, type=ftype))
        
        wiz.response.status(200, res)

    wiz.response.status(404, [])

def exists(segment):
    path = wiz.request.query("path", True)
    wiz.response.status(200, fs.exists(path))

def create():
    path = wiz.request.query("path", True)
    _type = wiz.request.query("type", True)

    if fs.exists(path):
        wiz.response.status(401, False)
    
    try:
        if _type == 'folder':
            fs.makedirs(path)
        else:
            fs.write(path, "")
    except:
        wiz.response.status(500, False)

    wiz.response.status(200, True)

def delete():
    path = wiz.request.query("path", True)
    if len(path) == 0:
        wiz.response.status(401, False)
    if fs.exists(path):
        fs.delete(path)
    wiz.response.status(200, True)

def move():
    path = wiz.request.query("path", True)
    to = wiz.request.query("to", True)
    if len(path) == 0 or len(to) == 0:
        wiz.response.status(401, False)
    if fs.exists(path) == False:
        wiz.response.status(401, False)
    if fs.exists(to):
        wiz.response.status(401, False)
    fs.move(path, to)
    wiz.response.status(200, True)

def read():
    path = wiz.request.query("path", True)
    if fs.isfile(path):
        wiz.response.status(200, fs.read(path, ""))
    wiz.response.status(404)

def download(segment):
    path = segment.path
    extension = '.wizportal' if len(path.split("/")) == 2 else '.zip'
    path = fs.abspath(path)

    if fs.isdir(path):
        filename = os.path.splitext(os.path.basename(path))[0] + extension
        zippath = os.path.join(tempfile.gettempdir(), 'wiz', datetime.datetime.now().strftime("%Y%m%d"), str(int(time.time())), filename)
        if len(zippath) < 10: 
            wiz.response.abort(404)
        try:
            shutil.remove(zippath)
        except Exception as e:
            pass
        os.makedirs(os.path.dirname(zippath))
        zipdata = zipfile.ZipFile(zippath, 'w')
        for folder, subfolders, files in os.walk(path):
            for file in files:
                zipdata.write(os.path.join(folder, file), os.path.relpath(os.path.join(folder,file), path), compress_type=zipfile.ZIP_DEFLATED)
        zipdata.close()
        wiz.response.download(zippath, as_attachment=True, filename=filename)
    else:
        wiz.response.download(path, as_attachment=True)

    wiz.response.status(200, segment)

def update(segment):
    path = wiz.request.query("path", True)
    code = wiz.request.query("code", "")

    psegment = path.split("/")
    if len(psegment) > 3 and psegment[2] == 'app':
        modname = psegment[1]
        appid = psegment[3]
        appjsonpath = os.path.join("portal", modname, "app", appid, "app.json")
        tspath = os.path.join("portal", modname, "app", appid, "view.ts")

        if fs.isfile(appjsonpath):
            tscode = fs.read(tspath, "")
            appjson = fs.read.json(appjsonpath)

            app_id = f"portal.{modname}.{appid}"
            converter = Converter()
            selector = converter.component_selector(app_id)
            cinfo = converter.angular_component_info(tscode)

            injector = [f'[{x}]=""' for x in cinfo['inputs']] + [f'({x})=""' for x in cinfo['outputs']]
            injector = ", ".join(injector)
            appjson['template'] = selector + "(" + injector + ")"

            fs.write.json(appjsonpath, appjson)

    fs.write(path, code)
    wiz.response.status(200)

def upload(segment):
    path = wiz.request.query("path", True)
    filepath = wiz.request.query("filepath", "[]")
    filepath = json.loads(filepath)
    files = wiz.request.files()
    for i in range(len(files)):
        f = files[i]
        if len(filepath) > 0: name = filepath[i]
        else: name = f.filename
        name = os.path.join(path, name)
        fs.write.file(name, f)
    wiz.response.status(200)

def upload_root(segment):
    path = wiz.request.query("path", True)
    fs = workspace.fs(path)
    files = wiz.request.files()
    notuploaded = []
    
    for i in range(len(files)):
        f = files[i]
        name = f.filename
        app_id = ".".join(os.path.splitext(name)[:-1])
        if os.path.splitext(name)[-1] != ".wizportal":
            notuploaded.append(app_id)
            continue

        if fs.exists(app_id):
            notuploaded.append(app_id)
            continue

        fs.write.file(name, f)

        zippath = fs.abspath(name)
        unzippath = fs.abspath(app_id)
        with zipfile.ZipFile(zippath, 'r') as zip_ref:
           zip_ref.extractall(unzippath)

        fs.delete(name)

    wiz.response.status(200, notuploaded)

def upload_app(segment):
    path = wiz.request.query("path", True)
    fs = workspace.fs(path)

    files = wiz.request.files()
    notuploaded = []
    
    for i in range(len(files)):
        f = files[i]
        name = f.filename
        app_id = ".".join(os.path.splitext(name)[:-1])
        if os.path.splitext(name)[-1] != ".wizapp":
            notuploaded.append(app_id)
            continue

        if fs.exists(app_id):
            notuploaded.append(app_id)
            continue

        fs.write.file(name, f)

        zippath = fs.abspath(name)
        unzippath = fs.abspath(app_id)
        with zipfile.ZipFile(zippath, 'r') as zip_ref:
           zip_ref.extractall(unzippath)

        fs.delete(name)

        appinfo = fs.read.json(os.path.join(app_id, "app.json"), dict())
        appinfo['id'] = app_id
        appinfo['namespace'] = app_id
        fs.write.json(os.path.join(app_id, "app.json"), appinfo)

    wiz.response.status(200, notuploaded)

def build():
    portalfs = workspace.fs("portal")
    modules = portalfs.ls()

    def buildApp(module):
        appfs = workspace.fs(os.path.join("src", "app"))
        apps = portalfs.ls(os.path.join(module, "app"))
        for app in apps:
            targetpath = portalfs.abspath(os.path.join(module, "app", app))
            namespace = f"portal.{module}.{app}"
            appfs.copy(targetpath, namespace)
            appjson = appfs.read.json(os.path.join(namespace, "app.json"), dict())
            appjson['namespace'] = f"{module}.{app}"
            appjson['id'] = namespace
            appjson['mode'] = 'portal'
            if 'controller' in appjson and len(appjson['controller']) > 0:
                appjson['controller'] = "portal/" + module + "/" + appjson['controller']
            appfs.write.json(os.path.join(namespace, "app.json"), appjson)

    def buildApi(module):
        appfs = workspace.fs(os.path.join("src", "route"))
        apps = portalfs.ls(os.path.join(module, "route"))
        for app in apps:
            targetpath = portalfs.abspath(os.path.join(module, "route", app))
            namespace = f"portal.{module}.{app}"
            appfs.copy(targetpath, namespace)
            appjson = appfs.read.json(os.path.join(namespace, "app.json"), dict())
            appjson['id'] = namespace
            if 'controller' in appjson and len(appjson['controller']) > 0:
                appjson['controller'] = "portal/" + module + "/" + appjson['controller']
            appfs.write.json(os.path.join(namespace, "app.json"), appjson)

    def buildFiles(module, target, src):
        appfs = workspace.fs(os.path.join("src", target))
        appfs.makedirs(os.path.join("portal", module))
        
        files = portalfs.ls(os.path.join(module, src))
        for f in files:
            appfs.copy(portalfs.abspath(os.path.join(module, src, f)), os.path.join("portal", module, f))

    # remove portal app
    appfs = workspace.fs(os.path.join("src", "app"))
    apps = appfs.ls()
    for app in apps:
        if app.split(".")[0] == "portal":
            appfs.remove(app)

    # remove portal route
    appfs = workspace.fs(os.path.join("src", "route"))
    apps = appfs.ls()
    for app in apps:
        if app.split(".")[0] == "portal":
            appfs.remove(app)

    # remove portal
    appfs = workspace.fs(os.path.join("src", "controller")).remove("portal")
    appfs = workspace.fs(os.path.join("src", "model")).remove("portal")
    appfs = workspace.fs(os.path.join("src", "assets")).remove("portal")
    appfs = workspace.fs(os.path.join("src", "angular/libs")).remove("portal")

    for module in modules:
        buildApp(module)
        buildApi(module)
        buildFiles(module, "controller", "controller")
        buildFiles(module, "model", "model")
        buildFiles(module, "assets", "assets")
        buildFiles(module, "angular/libs", "libs")

    workspace.build()
    workspace.route.build()
    wiz.response.status(200)

def controllers():
    module = wiz.request.query("module", None)
    res = []
    try:
        if module is not None:
            ctrls = fs.list(os.path.join("portal", module, "controller"))
            for ctrl in ctrls:
                if fs.isfile(os.path.join("portal", module, "controller", ctrl)) and os.path.splitext(ctrl)[-1] == ".py":
                    res.append(ctrl[:-3])
    except:
        pass
    wiz.response.status(200, res)
