## WIZ Portal Framework
### How to Add

- install from github

```
wiz plugin add https://github.com/season-framework/wiz-plugin-portal-framework
```

- add configuration `System Setting - IDE Menu`

```
{
    "main": [
        ...

        {
            "name": "Portal Framework",
            "id": "portal.app.modules",
            "icon": "fa-solid fa-layer-group",
            "width": 240
        },

        ...
    ]
}
```