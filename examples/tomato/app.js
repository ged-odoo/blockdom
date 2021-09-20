(function () {

  const { component, html, render, useState } = tomato;

  function Counter() {
    let [value, setValue] = useState(0);
    let inc = () => setValue(value() + 1);
    return () => html`
      <div>
        <button onClick=${inc}>Increment counter</button>
        <p>
          Value: ${value()}
        </p>
      </div>`;
  }

  function Main() {
    return () => html`<div>${component(Counter)}</div>`;
  }

  render(Main, document.body);

})();
