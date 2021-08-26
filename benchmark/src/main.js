(function () {

  const { list, mount, patch, createBlock, withKey } = blockdom;

  let idCounter = 1;
  const adjectives = ["pretty", "large", "big", "small", "tall", "short", "long", "handsome", "plain", "quaint", "clean", "elegant", "easy", "angry", "crazy", "helpful", "mushy", "odd", "unsightly", "adorable", "important", "inexpensive", "cheap", "expensive", "fancy"],
    colours = ["red", "yellow", "blue", "green", "pink", "brown", "purple", "brown", "white", "black", "orange"],
    nouns = ["table", "chair", "house", "bbq", "desk", "car", "pony", "cookie", "sandwich", "burger", "pizza", "mouse", "keyboard"];

  function _random(max) { return Math.round(Math.random() * 1000) % max; };

  function buildData(count) {
    let data = new Array(count);
    for (let i = 0; i < count; i++) {
      const label = `${adjectives[_random(adjectives.length)]} ${colours[_random(colours.length)]} ${nouns[_random(nouns.length)]}`;
      data[i] = {
        id: idCounter++,
        label,
      }
    }
    return data;
  }

  function createStore(onUpdate) {
    let rows = [];
    let selectedRowId = null;

    return {
      get rows() { return rows },
      get selectedRowId() { return selectedRowId },
      run() {
        rows = buildData(1000);
        selectedRowId = null;
        onUpdate();
      },
      runLots() {
        rows = buildData(10_000);
        selectedRowId = null;
        onUpdate()
      },
      add() {
        rows = rows.concat(buildData(1000));
        onUpdate()
      },
      update() {
        let index = 0;
        while (index < rows.length) {
          rows[index].label = rows[index].label + " !!!";
          index += 10;
        }
        onUpdate()
      },
      clear() {
        rows = [];
        selectedRowId = null;
        onUpdate()
      },
      swapRows() {
        if (rows.length > 998) {
          let tmp = rows[1];
          rows[1] = rows[998];
          rows[998] = tmp;
        }
        onUpdate()
      },
      selectRow(id) {
        selectedRowId = id;
        onUpdate()
      },
      removeRow(id) {
        rows.splice(rows.findIndex(row => row.id === id), 1);
        onUpdate()
      }
    }
  }

  // ---------------------------------------------------------------------------

  const rowBlock = createBlock(`          
      <tr block-attribute-2="class">
        <td class="col-md-1"><block-text-0/></td>
        <td class="col-md-4">
            <a block-handler-3="click"><block-text-1/></a>
        </td>
        <td class="col-md-1">
            <a block-handler-4="click">
              <span class='glyphicon glyphicon-remove' aria-hidden="true" />
            </a>
        </td>
        <td class='col-md-6'/>
      </tr>`);

  const mainBlock = createBlock(`
      <div class='container'>
        <div class='jumbotron'>
          <div class='row'>
            <div class='col-md-6'>
              <h1>blockdom keyed</h1>
            </div>
            <div class='col-md-6'>
              <div class='row'>
                <div class="col-sm-6 smallpad">
                  <button type="button" class="btn btn-primary btn-block" id="run" block-handler-0="click">Create 1,000 rows</button>
                </div>
                <div class="col-sm-6 smallpad">
                    <button type="button" class="btn btn-primary btn-block" id="runlots" block-handler-1="click">Create 10,000 rows</button>
                </div>
                <div class="col-sm-6 smallpad">
                    <button type="button" class="btn btn-primary btn-block" id="add" block-handler-2="click">Append 1,000 rows</button>
                </div>
                <div class="col-sm-6 smallpad">
                    <button type="button" class="btn btn-primary btn-block" id="update" block-handler-3="click">Update every 10th row</button>
                </div>
                <div class="col-sm-6 smallpad">
                    <button type="button" class="btn btn-primary btn-block" id="clear" block-handler-4="click">Clear</button>
                </div>
                <div class="col-sm-6 smallpad">
                    <button type="button" class="btn btn-primary btn-block" id="swaprows" block-handler-5="click">Swap Rows</button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <table class='table table-hover table-striped test-data'>
          <tbody>
            <block-child-0/>
          </tbody>
        </table>
        <span class='preloadicon glyphicon glyphicon-remove' aria-hidden="true" />
      </div>`);

  // ---------------------------------------------------------------------------

  function Row(row) {
    let rowId = row.id;
    return rowBlock([
      rowId,
      row.label,
      rowId === store.selectedRowId ? "danger" : "",
      [store.selectRow, rowId],
      [store.removeRow, rowId],
    ]);
  }
  
  let cache = {};
  let nextCache = {};
  function Memo(row) {
    let rowId = row.id;
    let deps = [row.label, rowId === store.selectedRowId];
    let item = cache[rowId];
    if (item && item.deps[0] === deps[0] && item.deps[1] === deps[1]) {
      nextCache[rowId] = item;
      return item;
    }
    const rowBlock = Row(row);
    rowBlock.deps = deps;
    nextCache[rowId] = rowBlock;
    return rowBlock;
  }

  function RowList(rows) {
    cache = nextCache;
    nextCache = {};
    let items = rows.map(row => withKey(Memo(row), row.id));
    return list(items);
  }

  function template(store) {
    const data = [store.run, store.runLots, store.add, store.update, store.clear, store.swapRows];
    return mainBlock(data, [RowList(store.rows)])
  }

  // ---------------------------------------------------------------------------

  const store = createStore(update);

  let app = template(store);
  mount(app, document.body);

  function update() {
    patch(app, template(store));
  }

})();

