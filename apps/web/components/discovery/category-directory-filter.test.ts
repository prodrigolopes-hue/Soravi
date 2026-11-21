import assert from "node:assert/strict";
import test from "node:test";
import { filterCategoryDirectory } from "./category-directory-filter";

const categories = [{ id: "1", name: "Climatização", slug: "climatizacao" }, { id: "2", name: "Encanador", slug: "encanador" }, { id: "3", name: "Eletricista", slug: "eletricista" }];
test("pesquisa ignora acentos e diferenças de maiúsculas", () => {
  assert.deepEqual(filterCategoryDirectory(categories, "  CLIMATIZACAO ", "az").map((item) => item.id), ["1"]);
});
test("ordena sem alterar a lista original", () => {
  assert.deepEqual(filterCategoryDirectory(categories, "", "za").map((item) => item.name), ["Encanador", "Eletricista", "Climatização"]);
  assert.equal(categories[0]?.name, "Climatização");
});
