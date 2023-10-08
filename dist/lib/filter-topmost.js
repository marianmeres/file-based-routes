// cleans up [ /baz, /foo, /foo/bar ] to just [ /baz, /foo ]
export const filterTopMost = (list) => {
    let topmost = [];
    list = [...list].sort();
    // console.log(111, list);
    // quick-n-dirty, probably not the most optimal way... but this runs only once on
    // server bootstrap
    // 1. create blacklist
    const blacklist = [];
    for (let d of list) {
        if (list.find((v) => v.startsWith(`${d}/`))) {
            blacklist.push(`${d}/`);
        }
    }
    // console.log(222, blacklist);
    // 2. actual filter
    if (blacklist.length) {
        for (let d of blacklist) {
            topmost = [...topmost, ...list.filter((v) => !v.startsWith(d))];
        }
    }
    else {
        topmost = list;
    }
    // console.log(333, topmost);
    return topmost;
};
