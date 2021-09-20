(function () {
  const { createBlock, list, mount, patch } = blockdom;

  const counterBlock = createBlock(`
    <div class="counter">
        <button block-handler-1="click">Increment</button>
        <span>Value: <block-text-0/></span>
    </div>`);

  const mainBlock = createBlock(`
    <div>
        <div><button block-handler-0="click">Add a counter</button></div>
        <div><block-child-0/></div>
    </div>`);

  const state = [{ id: 0, value: 3 }];

  function addCounter() {
    state.push({ value: 0, id: state.length });
    update();
  }

  function incrementCounter(id) {
    const counter = state.find(c => c.id === id);
    counter.value++;
    update();
  }

  function render(state) {
    const counters = state.map(c => {
      const handler = [incrementCounter, c.id];
      return Object.assign(counterBlock([c.value, handler]), { key: c.id });
    })
    return mainBlock([addCounter], [list(counters)]);
  }

  let tree = render(state);
  mount(tree, document.body);

  function update() {
    patch(tree, render(state));
  }
})();
