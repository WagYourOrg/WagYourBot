//element id direct references
declare const roles: HTMLDataListElement;


function newAlias(command: string, el: HTMLElement) {
    (<Element>el.parentNode)?.insertAdjacentHTML('beforebegin',`<div class="input"><input class="alias" type="text" name="${command}.aliases" value="${(<HTMLInputElement>(<Element>el.parentNode).firstChild).value}" data-lpignore="true"><input class="button" type="button" value="x" onclick="this.parentNode.remove()"></div>`);
    (<HTMLInputElement>(<Element>el.parentNode).firstChild).value = "";
}

function newPerm(command: string, el: HTMLElement) {
    (<Element>el.parentNode)?.insertAdjacentHTML('beforebegin',`<div class="input" style="${ (<HTMLElement>el.parentNode).style.cssText}"><input class="perm" type="text" name="${command}.perms" value="${(<HTMLInputElement>(<Element>el.parentNode).firstChild).value}" style="${(<HTMLInputElement>(<Element>el.parentNode).firstChild).style.cssText}" list="roles" onkeyup="changeColor(this)" onchange="changeColor(this)" onpaste="changeColor(this)" data-lpignore="true"><input class="button" type="button" value="x" onclick="this.parentNode.remove()"></div>`);
    (<HTMLInputElement>(<Element>el.parentNode).firstChild).value = "";
    (<HTMLInputElement>(<Element>el.parentNode).firstChild).removeAttribute("style");
    (<HTMLElement>el.parentNode).removeAttribute("style");
}
window.addEventListener("resize", () => {
    (<HTMLElement>document.getElementsByClassName("pluginContent")[0]).style.height = `${window.innerHeight - (<HTMLElement>document.getElementsByClassName("saveBar")[0]).offsetHeight - (<HTMLElement>document.getElementsByClassName("topbar")[0]).offsetHeight - (<HTMLElement>document.getElementsByClassName("footer")[0]).offsetHeight}px`;
});

const rolelist: {[key: string]: `rgb(${number}, ${number}, ${number})`} = {"": "rgb(0, 0, 0)"}

Array.from( roles.options).forEach(role => {
    rolelist[role.innerText] = <`rgb(${number}, ${number}, ${number})`>role.style.color;
});

function changeColor(el: HTMLInputElement) {
    if (rolelist[el.value]) {
        el.style.color = rolelist[el.value];
        (<HTMLElement>el.parentNode).style.border = "1px solid green";
    }
    else {
        el.style.color = "rgb(0, 0, 0)";
        (<HTMLElement>el.parentNode).style.border = "1px solid red";
    }
}
