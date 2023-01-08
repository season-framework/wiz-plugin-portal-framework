import { CollectionViewer, SelectionChange, DataSource } from '@angular/cdk/collections';
import { BehaviorSubject, merge, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/** Flat node with expandable and level information */
export class FileNode {
    constructor(
        public name: string,
        public path: string,
        public type: string = 'file',
        public parent: FileNode | null = null,
        public level: number = -1,
        public meta: any = {}
    ) {
        this.rename = name + '';
    }

    public rename: string = "";
    public isLoading: boolean = false;
    public editable: boolean = false;
    public extended: boolean = false;
}

export class FileDataSource implements DataSource<FileNode> {
    public dataChange = new BehaviorSubject<FileNode[]>([]);

    get data(): FileNode[] {
        return this.dataChange.value;
    }

    set data(value: FileNode[]) {
        this.component.treeControl.dataNodes = value;
        this.dataChange.next(value);
    }

    constructor(private component: any) { }

    connect(collectionViewer: CollectionViewer): Observable<FileNode[]> {
        this.component.treeControl.expansionModel.changed.subscribe(change => {
            if ((change as SelectionChange<FileNode>).added || (change as SelectionChange<FileNode>).removed) {
                this.handleTreeControl(change as SelectionChange<FileNode>);
            }
        });
        return merge(collectionViewer.viewChange, this.dataChange).pipe(map(() => this.data));
    }

    disconnect(collectionViewer: CollectionViewer): void { }

    async handleTreeControl(change: SelectionChange<FileNode>) {
        if (change.added) {
            change.added.forEach(async (node) => {
                await this.toggle(node, true)
            });
        }

        if (change.removed) {
            change.removed.slice().reverse().forEach(async (node) => {
                await this.toggle(node, false);
            });
        }
    }

    async prepend(node: FileNode, to: FileNode | null) {
        let index = 0;
        if (to) {
            index = this.data.indexOf(to);
            if (index < 0)
                return;
            index = index + 1;
            node.level = to.level + 1;
        }
        this.data.splice(index, 0, node);
        this.dataChange.next(this.data);
    }

    async delete(node: FileNode) {
        let index = this.data.indexOf(node);
        if (index < 0)
            return;
        this.toggle(node, false);
        this.data.splice(index, 1);
        this.dataChange.next(this.data);
    }

    async toggle(node: FileNode, expand: boolean) {
        const index = this.data.indexOf(node);
        if (index < 0) {
            this.dataChange.next(this.data);
            return;
        }

        if (expand) {
            node.isLoading = true;
            let count = 0;
            for (
                let i = index + 1;
                i < this.data.length && this.data[i].level > node.level;
                i++, count++
            ) { }
            this.data.splice(index + 1, count);

            const nodes = await this.component.list(node);
            this.data.splice(index + 1, 0, ...nodes);
            node.isLoading = false;
            node.extended = true;
        } else {
            let count = 0;
            for (
                let i = index + 1;
                i < this.data.length && this.data[i].level > node.level;
                i++, count++
            ) { }
            this.data.splice(index + 1, count);
            node.extended = false;
        }

        this.dataChange.next(this.data);
        await this.component.service.render();
    }
}


import MonacoEditor from "src/app/core.editor.monaco/core.editor.monaco.component";
import PageInfoEditor from "src/app/workspace.editor.ngapp.page/workspace.editor.ngapp.page.component";
import AppInfoEditor from "src/app/workspace.editor.ngapp.info/workspace.editor.ngapp.info.component";
import RouteInfoEditor from "src/app/workspace.editor.route/workspace.editor.route.component";
const DEFAULT_COMPONENT = `import { OnInit, Input } from '@angular/core';

export class Replacement implements OnInit {
    @Input() title: any;

    public async ngOnInit() {
    }
}`.replace('Replacement', 'Component');


import toastr from "toastr";
toastr.options = {
    "closeButton": false,
    "debug": false,
    "newestOnTop": true,
    "progressBar": false,
    "positionClass": "toast-top-center",
    "preventDuplicates": true,
    "onclick": null,
    "showDuration": 300,
    "hideDuration": 500,
    "timeOut": 1500,
    "extendedTimeOut": 1000,
    "showEasing": "swing",
    "hideEasing": "linear",
    "showMethod": "fadeIn",
    "hideMethod": "fadeOut"
};

export class FileEditor {
    public APP_ID: string = "portal.app.modules";
    constructor(private service: any, private wiz: any, private event: any) {
        if (!this.event) this.event = {};
    }

    public async create(path: any) {
        let wiz = this.wiz.app(this.APP_ID);
        let eventHanlder = async (name, appinfo) => {
            if (this.event[name]) await this.event[name](appinfo);
        }

        let viewtypes: any = {
            'md': { viewref: MonacoEditor, config: { monaco: { language: 'markdown' } } },
            'ts': { viewref: MonacoEditor, config: { monaco: { language: 'typescript', renderValidationDecorations: 'off' } } },
            'js': { viewref: MonacoEditor, config: { monaco: { language: 'javascript' } } },
            'css': { viewref: MonacoEditor, config: { monaco: { language: 'css' } } },
            'scss': { viewref: MonacoEditor, config: { monaco: { language: 'scss' } } },
            'json': { viewref: MonacoEditor, config: { monaco: { language: 'json' } } },
            'pug': { viewref: MonacoEditor, config: { monaco: { language: 'pug' } } },
            'py': { viewref: MonacoEditor, config: { monaco: { language: 'python' } } }
        };

        let extension = path.substring(path.lastIndexOf(".") + 1).toLowerCase();
        if (!viewtypes[extension]) {
            return;
        }

        let { viewref, config } = viewtypes[extension];
        let editor = this.service.editor.create({
            component_id: this.APP_ID,
            path: path,
            title: path.split("/")[path.split("/").length - 1],
            unique: true,
            current: 0
        });

        editor.create({
            name: 'file',
            viewref: viewref,
            path: path,
            config: config
        }).bind('data', async (tab) => {
            let { code, data } = await wiz.call('read', { path: path });
            if (code != 200) return {};
            return { data };
        }).bind('update', async (tab) => {
            let data = await tab.data();
            let code = data.data;
            let res = await wiz.call("update", { path, code });
            if (res.code != 200) return;
            await eventHanlder('updated', path);
            toastr.success("Updated");
            res = await wiz.call('build', { path: path });
            if (res.code == 200) toastr.info("Builded");
            else toastr.error("Error on build");
            let previewBinding = this.service.event.load("workspace.app.preview");
            if (previewBinding) await previewBinding.move();
        });

        return editor;
    }
}

export class RouteEditor {
    public APP_ID: string = "portal.app.modules";
    constructor(private service: any, private wiz: any, private event: any) {
        if (!this.event) this.event = {};
    }

    public async create(mod_id: string, app: any) {
        let binding = this.service.event.load(this.APP_ID);
        let wiz = this.wiz.app(this.APP_ID);
        let eventHanlder = async (name, appinfo) => {
            if (this.event[name]) await this.event[name](appinfo);
        }

        const BASEPATH = "portal/" + mod_id + "/route";
        let app_id = app.id;
        let path = BASEPATH + "/" + (app_id ? app_id : 'new');
        let component_id = "portal." + mod_id + "." + app_id;

        let editor = this.service.editor.create(app.id ? {
            component_id: this.APP_ID,
            path: path,
            title: app.title,
            subtitle: component_id,
            unique: true,
            current: 1
        } : {
            component_id: this.APP_ID,
            unique: true,
            title: 'new'
        });

        editor.id_prefix = "portal." + mod_id + ".";

        let ctrls = await wiz.call("controllers", { module: mod_id });
        ctrls = ctrls.data;
        editor.ctrls = ctrls;

        let move = async (name, rename) => {
            if (name == rename) {
                return false;
            }

            let path = BASEPATH + "/" + name;
            let to = BASEPATH + "/" + rename;

            let { code } = await wiz.call("move", { path, to });
            if (code !== 200) {
                toastr.error("Error: rename api");
                return false;
            }

            return true;
        }

        let update = async (path: string, code: string, event: boolean = true) => {
            let appinfo = await editor.tab(0).data();
            let res = await wiz.call("update", { path, code });
            if (res.code == 200) toastr.success("Updated");
            else return false;

            let upath = BASEPATH + "/" + appinfo.id;
            editor.modify({ path: upath, title: appinfo.title });

            for (let i = 0; i < editor.tabs.length; i++) {
                let topath: any = editor.tabs[i].path + '';
                topath = topath.split("/");
                topath[topath.length - 2] = appinfo.id;
                topath = topath.join("/");
                editor.tabs[i].move(topath);
            }

            if (event) {
                if (binding) {
                    let node = binding.find(upath);
                    if (node) {
                        node.path = node.path.split("/")
                        node.path[node.path - 2] = appinfo.id;
                        node.path = node.path.join("/");
                        node.name = appinfo.title;
                        if (node.parent)
                            await binding.refresh(node.parent);
                    } else {
                        node = binding.find(BASEPATH);
                        await binding.refresh(node);
                    }
                }
                await eventHanlder('updated', appinfo);
            }

            return true;
        }

        let build = async (path: any) => {
            let appinfo = await editor.tab(0).data();
            let res = await wiz.call('build', { path });
            if (res.code != 200) {
                toastr.error("Error on build");
                return false;
            }

            toastr.info("Builded");
            await eventHanlder('builded', appinfo);

            let previewBinding = this.service.event.load("workspace.app.preview");
            if (previewBinding) await previewBinding.move(appinfo.preview);
        }

        let createApp = async (appinfo: any) => {
            let id = appinfo.id;
            let res = await wiz.call("exists", { path: BASEPATH + "/" + id });
            if (res.data) return toastr.error("id already exists");
            let path = BASEPATH + "/" + id + "/app.json";
            let code = JSON.stringify(appinfo, null, 4);
            await update(path, code);
            editor.close();
            return true;
        }

        let updateApp = async (appinfo: any) => {
            let name = editor.meta.id;
            let rename = appinfo.id;

            if (name != rename) {
                let res = await move(name, rename);
                if (!res) {
                    toastr.error("invalidate namespace");
                    return false;
                }
            }

            let path = BASEPATH + "/" + appinfo.id + "/app.json";
            let code = JSON.stringify(appinfo, null, 4);
            await update(path, code);
            editor.meta.id = appinfo.id;
            await build(path);
            return true;
        }

        editor.create({
            name: 'info',
            viewref: RouteInfoEditor,
            path: path + "/app.json"
        }).bind('data', async (tab) => {
            if (app.id) {
                let { code, data } = await wiz.call('read', { path: tab.path });
                if (code != 200) return {};
                data = JSON.parse(data);
                editor.meta.id = data.id;
                return data;
            } else {
                return JSON.parse(JSON.stringify(app));
            }
        }).bind('update', async (tab) => {
            let appinfo = await tab.data();

            let check = /^[a-z0-9.]+$/.test(appinfo.id);
            if (!check) return toastr.error("invalidate id");
            if (appinfo.id.length < 3) return toastr.error("id at least 3 alphabets");

            if (app.id)
                await updateApp(appinfo);
            else
                await createApp(appinfo);
        });

        if (app.id) {
            editor.create({
                name: 'Controller',
                viewref: MonacoEditor,
                path: path + "/controller.py",
                config: { monaco: { language: 'python' } }
            }).bind('data', async (tab) => {
                tab.meta.info = await editor.tab(0).data();
                let { code, data } = await wiz.call('read', { path: tab.path });
                if (code != 200) data = '';
                return { data };
            }).bind('update', async (tab) => {
                let path = tab.path;
                let code = await tab.data();
                await update(path, code.data);
                await build(path);
            });

            editor.bind("delete", async () => {
                let appinfo = await editor.tab(0).data();
                let res = await this.service.alert.show({ title: 'Delete Route', message: 'Are you sure remove "' + editor.title + '"?', action_text: "Delete", action_class: "btn-danger" });
                if (res !== true) return;

                let targets = await this.service.editor.find(editor);
                for (let i = 0; i < targets.length; i++)
                    await targets[i].close();

                await wiz.call("delete", { path: BASEPATH + "/" + appinfo.id });

                if (binding) {
                    let node = binding.find(BASEPATH);
                    if (node) await binding.refresh(node);
                }

                await build(path);
                await eventHanlder('deleted', appinfo);
            });
        }

        return editor;
    }
}

export class AppEditor {
    public APP_ID: string = "portal.app.modules";
    constructor(private service: any, private wiz: any, private event: any) {
        if (!this.event) this.event = {};
    }

    public async create(mod_id: string, app: any, ieditor: any) {
        let binding = this.service.event.load(this.APP_ID);
        let wiz = this.wiz.app(this.APP_ID);
        let eventHanlder = async (name, appinfo) => {
            if (this.event[name]) await this.event[name](appinfo);
        }

        let BASEPATH = "portal/" + mod_id + "/app";
        if (app.mode == 'sample') BASEPATH = "portal/" + mod_id + "/sample";

        let app_id = app.id;
        let path = BASEPATH + "/" + (app_id ? app_id : 'new');
        let component_id = "portal." + mod_id + "." + app_id;
        if (app.mode == 'sample') component_id = app_id;

        let editor = this.service.editor.create(app_id ? {
            component_id: this.APP_ID,
            path: path,
            title: app.title ? app.title : app.namespace,
            subtitle: component_id,
            current: 1
        } : {
            component_id: this.APP_ID,
            unique: true,
            title: 'new',
        });

        if (app.mode != 'sample')
            editor.namespace_prefix = "portal." + mod_id + ".";

        let ctrls = await wiz.call("controllers", { module: mod_id });
        ctrls = ctrls.data;
        editor.ctrls = ctrls;

        let move = async (name, rename) => {
            if (name == rename) {
                return false;
            }

            let path = BASEPATH + "/" + name;
            let to = BASEPATH + "/" + rename;

            let { code } = await wiz.call("move", { path, to });
            if (code !== 200) {
                toastr.error("Error: rename app");
                return false;
            }

            return true;
        }

        let update = async (path: string, code: string, event: boolean = true) => {
            let appinfo = await editor.tab(0).data();
            let res = await wiz.call("update", { path, code });
            if (res.code == 200) toastr.success("Updated");
            else return false;

            let upath = BASEPATH + "/" + appinfo.id;
            component_id = "portal." + mod_id + "." + appinfo.id;
            if (app.mode == 'sample') component_id = app_id;
            editor.modify({ path: upath, title: appinfo.title ? appinfo.title : appinfo.namespace, subtitle: component_id });

            for (let i = 0; i < editor.tabs.length; i++) {
                let topath: any = editor.tabs[i].path + '';
                topath = topath.split("/");
                topath[topath.length - 2] = appinfo.id;
                topath = topath.join("/");
                editor.tabs[i].move(topath);
            }

            if (event) {
                if (binding) {
                    let node = binding.find(upath);
                    if (node) {
                        node.path = node.path.split("/")
                        node.path[node.path.length - 2] = appinfo.id;
                        node.path = node.path.join("/");
                        node.name = appinfo.title;
                        if (node.parent)
                            await binding.refresh(node.parent);
                    } else {
                        node = binding.find(BASEPATH);
                        await binding.refresh(node);
                    }
                }
                await eventHanlder('updated', appinfo);
            }

            await this.service.render();
            return true;
        }

        let build = async (path: any) => {
            let appinfo = await editor.tab(0).data();
            let res = await wiz.call('build', { path });
            if (res.code != 200) {
                toastr.error("Error on build");
                return false;
            }

            toastr.info("Builded");
            await eventHanlder('builded', appinfo);

            let previewBinding = this.service.event.load("workspace.app.preview");
            if (previewBinding) await previewBinding.move(appinfo.preview);
        }

        let createApp = async (appinfo: any) => {
            let id = appinfo.namespace;
            let res = await wiz.call("exists", { path: BASEPATH + "/" + id });
            if (res.data) return toastr.error("namespace already exists");
            appinfo.id = id;
            let path = BASEPATH + "/" + id + "/app.json";
            let code = JSON.stringify(appinfo, null, 4);
            await update(path, code, false);

            path = BASEPATH + "/" + id + "/view.ts";
            await update(path, DEFAULT_COMPONENT);

            editor.close();

            return true;
        }

        let updateApp = async (appinfo: any) => {
            let name = appinfo.id + '';
            let rename = appinfo.namespace;

            if (name != rename) {
                let res = await move(name, rename);
                if (!res) {
                    toastr.error("invalidate namespace");
                    return false;
                }
            }

            appinfo.id = rename;

            let path = BASEPATH + "/" + appinfo.id + "/app.json";
            let code = JSON.stringify(appinfo, null, 4);
            await update(path, code);
            await build(path);
            return true;
        }

        editor.create(app.id ? {
            name: 'info',
            viewref: ieditor,
            path: path + "/app.json"
        } : {
            name: 'info',
            viewref: ieditor
        }).bind('data', async (tab) => {
            if (app.id) {
                let { code, data } = await wiz.call('read', { path: tab.path });
                if (code != 200) return {};
                data = JSON.parse(data);
                return data;
            } else {
                return JSON.parse(JSON.stringify(app));
            }
        }).bind('update', async (tab) => {
            let appinfo = await tab.data();

            if (app.mode == 'sample') {
                if (app.id) {
                    if (app.id.split(".")[0] != appinfo.namespace.split(".")[0]) {
                        return toastr.error("first namespace not allowed to change");
                    }
                } else {
                    let mtype = appinfo.namespace.split(".")[0];
                    if (ieditor == PageInfoEditor) {
                        if (mtype != 'page') {
                            return toastr.error("first namespace must `page`");
                        }
                    } else {
                        if (mtype != 'component' && mtype != 'layout') {
                            return toastr.error("first namespace must `component` or `layout`");
                        }
                    }
                }

            }

            let check = /^[a-z0-9.]+$/.test(appinfo.namespace);
            if (!check) return toastr.error("invalidate namespace");
            if (appinfo.namespace.length < 3) return toastr.error("namespace at least 3 alphabets");

            if (app.id)
                await updateApp(appinfo);
            else
                await createApp(appinfo);
        });

        if (app.id) {
            let tabs: any = [
                editor.create({
                    name: 'Pug',
                    viewref: MonacoEditor,
                    path: path + "/view.pug",
                    config: { monaco: { language: 'pug' } }
                }),
                editor.create({
                    name: 'Component',
                    viewref: MonacoEditor,
                    path: path + "/view.ts",
                    config: { monaco: { language: 'typescript', renderValidationDecorations: 'off' } }
                }),
                editor.create({
                    name: 'SCSS',
                    viewref: MonacoEditor,
                    path: path + "/view.scss",
                    config: { monaco: { language: 'scss' } }
                }),
                editor.create({
                    name: 'API',
                    viewref: MonacoEditor,
                    path: path + "/api.py",
                    config: { monaco: { language: 'python' } }
                }),
                editor.create({
                    name: 'Socket',
                    viewref: MonacoEditor,
                    path: path + "/socket.py",
                    config: { monaco: { language: 'python' } }
                })
            ];

            for (let i = 0; i < tabs.length; i++) {
                tabs[i].bind('data', async (tab) => {
                    let { code, data } = await wiz.call('read', { path: tab.path });
                    if (code != 200) data = '';
                    return { data };
                }).bind('update', async (tab) => {
                    let path = tab.path;
                    let code = await tab.data();
                    await update(path, code.data);
                    await build(path);
                });
            }

            editor.bind("delete", async () => {
                let appinfo = await editor.tab(0).data();
                let res = await this.service.alert.show({ title: 'Delete App', message: 'Are you sure remove "' + appinfo.title + '"?', action_text: "Delete", action_class: "btn-danger" });
                if (res !== true) return;
                let targets = await this.service.editor.find(editor);
                for (let i = 0; i < targets.length; i++)
                    await targets[i].close();
                await wiz.call("delete", { path: BASEPATH + "/" + appinfo.id });

                if (binding) {
                    let node = binding.find(BASEPATH);
                    if (node) await binding.refresh(node);
                }

                await eventHanlder('deleted', appinfo);
                await build(path);
            });

            editor.bind("clone", async (location: number = -1) => {
                let appinfo = await editor.tab(0).data();
                let clone = await this.create(appinfo);
                await clone.open(location);
            });
        }

        return editor;
    }
}

export class Workspace {
    constructor(private service: any, private wiz: any) { }

    public async AppEditor(mod_id: string, app: any, event: any = {}) {
        return await new AppEditor(this.service, this.wiz, event).create(mod_id, app, AppInfoEditor);
    }

    public async PageEditor(mod_id: string, app: any, event: any = {}) {
        return await new AppEditor(this.service, this.wiz, event).create(mod_id, app, PageInfoEditor);
    }

    public async RouteEditor(mod_id: string, app: any, event: any = {}) {
        return await new RouteEditor(this.service, this.wiz, event).create(mod_id, app);
    }

    public async FileEditor(path: string, event: any = {}) {
        return await new FileEditor(this.service, this.wiz, event).create(path);
    }
}

export default Workspace;