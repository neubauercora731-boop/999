const output = document.querySelector("#count");
const button = document.querySelector("#increment");

let count = 0;

button.addEventListener("click", () => {
  count += 1;
  output.textContent = String(count);
});
