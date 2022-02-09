import { createBlock, html, mount, multi, patch, text } from "../src";
import { makeTestFixture } from "./helpers";

//------------------------------------------------------------------------------
// Setup and helpers
//------------------------------------------------------------------------------

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

afterEach(() => {
  fixture.remove();
});

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

describe("html block", () => {
  test("can be mounted and patched", async () => {
    const tree = html("<span>1</span><span>2</span>");
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("<span>1</span><span>2</span>");

    patch(tree, html("<div>coucou</div>"));
    expect(fixture.innerHTML).toBe("<div>coucou</div>");
  });

  test("html vnode can be used as text", () => {
    mount(text(html("<p>a</p>") as any), fixture);
    expect(fixture.textContent).toBe("<p>a</p>");
  });

  test("html vnode can represent <tr>", () => {
    const fixture = document.createElement("table");
    // const block = createBlock('<table><block-child-0/></table>');
    // const tree = block([], [html(`<tr><td>tomato</td></tr>`)]);
    const tree = html(`<tr><td>tomato</td></tr>`);
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("<tr><td>tomato</td></tr>");

    patch(tree, html(`<tr><td>potato</td></tr>`));
    expect(fixture.innerHTML).toBe("<tr><td>potato</td></tr>");
  });

  test("html vnode can be used in a multi, and updated", () => {
    const tree = multi([html("<p>a</p>"), html("<p>b</p>")]);
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("<p>a</p><p>b</p>");

    patch(tree, multi([html("<p>b</p>"), html("<p>a</p>")]));
    expect(fixture.innerHTML).toBe("<p>b</p><p>a</p>");

    patch(tree, multi([html("<p>a</p>"), html("<p>b</p>")]));
    expect(fixture.innerHTML).toBe("<p>a</p><p>b</p>");
  });
});
