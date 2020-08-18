// Menu
const burger = document.querySelector("#navbar__togle");
const mobileMenu = document.querySelector("#mobileMenu");
const cross = document.querySelector("#mobileMenuCross");
const backg = document.querySelector("#backg");
const body = document.querySelector("body");

function burgerMenu(e) {
  if (e.target === burger) {
    burger.classList.toggle("menu-icon-active");
  }
  mobileMenu.classList.toggle("mobile-menu_active");
  backg.classList.toggle("backg_active");
  body.classList.toggle("lock");
  function DetectMobile() {
    let uagent = navigator.userAgent.toLowerCase();
    if (uagent.search("mobile") == -1) body.classList.toggle("hideScrl");
  }
  DetectMobile();
}

burger.addEventListener("click", burgerMenu);
cross.addEventListener("click", burgerMenu);
backg.addEventListener("click", burgerMenu);

// OwlCarousel2

$(document).ready(function () {
  $(".owl-carousel").owlCarousel({
    items: 1,
    loop: true,
    freeDrag: true,
    // autoplay: true,
    autoplayHoverPause: true,
    freeDrag: false,
    nav: true,
  });
});

//Slider for product gallery

/* Индекс слайда по умолчанию */
var slideIndex = 1;
showSlides(slideIndex);
/* Функция увеличивает индекс на 1, показывает следующй слайд*/
function plusSlide() {
  showSlides((slideIndex += 1));
}
/* Функция уменьшяет индекс на 1, показывает предыдущий слайд*/
function minusSlide() {
  showSlides((slideIndex -= 1));
}
/* Устанавливает текущий слайд */
function currentSlide(n) {
  showSlides((slideIndex = n));
}
/* Основная функция слайдера */
function showSlides(n) {
  var i;
  var slides = document.getElementsByClassName("item");
  var dots = document.getElementsByClassName("slider-dots_item");
  if (n > slides.length) {
    slideIndex = 1;
  }
  if (n < 1) {
    slideIndex = slides.length;
  }
  for (i = 0; i < slides.length; i++) {
    slides[i].style.display = "none";
  }
  for (i = 0; i < dots.length; i++) {
    dots[i].className = dots[i].className.replace(" active", "");
  }
  slides[slideIndex - 1].style.display = "block";
  dots[slideIndex - 1].className += " active";
}
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiIiwic291cmNlcyI6WyJtYWluLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIE1lbnVcclxuY29uc3QgYnVyZ2VyID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIiNuYXZiYXJfX3RvZ2xlXCIpO1xyXG5jb25zdCBtb2JpbGVNZW51ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIiNtb2JpbGVNZW51XCIpO1xyXG5jb25zdCBjcm9zcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIjbW9iaWxlTWVudUNyb3NzXCIpO1xyXG5jb25zdCBiYWNrZyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIjYmFja2dcIik7XHJcbmNvbnN0IGJvZHkgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiYm9keVwiKTtcclxuXHJcbmZ1bmN0aW9uIGJ1cmdlck1lbnUoZSkge1xyXG4gIGlmIChlLnRhcmdldCA9PT0gYnVyZ2VyKSB7XHJcbiAgICBidXJnZXIuY2xhc3NMaXN0LnRvZ2dsZShcIm1lbnUtaWNvbi1hY3RpdmVcIik7XHJcbiAgfVxyXG4gIG1vYmlsZU1lbnUuY2xhc3NMaXN0LnRvZ2dsZShcIm1vYmlsZS1tZW51X2FjdGl2ZVwiKTtcclxuICBiYWNrZy5jbGFzc0xpc3QudG9nZ2xlKFwiYmFja2dfYWN0aXZlXCIpO1xyXG4gIGJvZHkuY2xhc3NMaXN0LnRvZ2dsZShcImxvY2tcIik7XHJcbiAgZnVuY3Rpb24gRGV0ZWN0TW9iaWxlKCkge1xyXG4gICAgbGV0IHVhZ2VudCA9IG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKTtcclxuICAgIGlmICh1YWdlbnQuc2VhcmNoKFwibW9iaWxlXCIpID09IC0xKSBib2R5LmNsYXNzTGlzdC50b2dnbGUoXCJoaWRlU2NybFwiKTtcclxuICB9XHJcbiAgRGV0ZWN0TW9iaWxlKCk7XHJcbn1cclxuXHJcbmJ1cmdlci5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgYnVyZ2VyTWVudSk7XHJcbmNyb3NzLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBidXJnZXJNZW51KTtcclxuYmFja2cuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGJ1cmdlck1lbnUpO1xyXG5cclxuLy8gT3dsQ2Fyb3VzZWwyXHJcblxyXG4kKGRvY3VtZW50KS5yZWFkeShmdW5jdGlvbiAoKSB7XHJcbiAgJChcIi5vd2wtY2Fyb3VzZWxcIikub3dsQ2Fyb3VzZWwoe1xyXG4gICAgaXRlbXM6IDEsXHJcbiAgICBsb29wOiB0cnVlLFxyXG4gICAgZnJlZURyYWc6IHRydWUsXHJcbiAgICAvLyBhdXRvcGxheTogdHJ1ZSxcclxuICAgIGF1dG9wbGF5SG92ZXJQYXVzZTogdHJ1ZSxcclxuICAgIGZyZWVEcmFnOiBmYWxzZSxcclxuICAgIG5hdjogdHJ1ZSxcclxuICB9KTtcclxufSk7XHJcblxyXG4vL1NsaWRlciBmb3IgcHJvZHVjdCBnYWxsZXJ5XHJcblxyXG4vKiDQmNC90LTQtdC60YEg0YHQu9Cw0LnQtNCwINC/0L4g0YPQvNC+0LvRh9Cw0L3QuNGOICovXHJcbnZhciBzbGlkZUluZGV4ID0gMTtcclxuc2hvd1NsaWRlcyhzbGlkZUluZGV4KTtcclxuLyog0KTRg9C90LrRhtC40Y8g0YPQstC10LvQuNGH0LjQstCw0LXRgiDQuNC90LTQtdC60YEg0L3QsCAxLCDQv9C+0LrQsNC30YvQstCw0LXRgiDRgdC70LXQtNGD0Y7RidC5INGB0LvQsNC50LQqL1xyXG5mdW5jdGlvbiBwbHVzU2xpZGUoKSB7XHJcbiAgc2hvd1NsaWRlcygoc2xpZGVJbmRleCArPSAxKSk7XHJcbn1cclxuLyog0KTRg9C90LrRhtC40Y8g0YPQvNC10L3RjNGI0Y/QtdGCINC40L3QtNC10LrRgSDQvdCwIDEsINC/0L7QutCw0LfRi9Cy0LDQtdGCINC/0YDQtdC00YvQtNGD0YnQuNC5INGB0LvQsNC50LQqL1xyXG5mdW5jdGlvbiBtaW51c1NsaWRlKCkge1xyXG4gIHNob3dTbGlkZXMoKHNsaWRlSW5kZXggLT0gMSkpO1xyXG59XHJcbi8qINCj0YHRgtCw0L3QsNCy0LvQuNCy0LDQtdGCINGC0LXQutGD0YnQuNC5INGB0LvQsNC50LQgKi9cclxuZnVuY3Rpb24gY3VycmVudFNsaWRlKG4pIHtcclxuICBzaG93U2xpZGVzKChzbGlkZUluZGV4ID0gbikpO1xyXG59XHJcbi8qINCe0YHQvdC+0LLQvdCw0Y8g0YTRg9C90LrRhtC40Y8g0YHQu9Cw0LnQtNC10YDQsCAqL1xyXG5mdW5jdGlvbiBzaG93U2xpZGVzKG4pIHtcclxuICB2YXIgaTtcclxuICB2YXIgc2xpZGVzID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZShcIml0ZW1cIik7XHJcbiAgdmFyIGRvdHMgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKFwic2xpZGVyLWRvdHNfaXRlbVwiKTtcclxuICBpZiAobiA+IHNsaWRlcy5sZW5ndGgpIHtcclxuICAgIHNsaWRlSW5kZXggPSAxO1xyXG4gIH1cclxuICBpZiAobiA8IDEpIHtcclxuICAgIHNsaWRlSW5kZXggPSBzbGlkZXMubGVuZ3RoO1xyXG4gIH1cclxuICBmb3IgKGkgPSAwOyBpIDwgc2xpZGVzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICBzbGlkZXNbaV0uc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xyXG4gIH1cclxuICBmb3IgKGkgPSAwOyBpIDwgZG90cy5sZW5ndGg7IGkrKykge1xyXG4gICAgZG90c1tpXS5jbGFzc05hbWUgPSBkb3RzW2ldLmNsYXNzTmFtZS5yZXBsYWNlKFwiIGFjdGl2ZVwiLCBcIlwiKTtcclxuICB9XHJcbiAgc2xpZGVzW3NsaWRlSW5kZXggLSAxXS5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiO1xyXG4gIGRvdHNbc2xpZGVJbmRleCAtIDFdLmNsYXNzTmFtZSArPSBcIiBhY3RpdmVcIjtcclxufSJdLCJmaWxlIjoibWFpbi5qcyJ9
