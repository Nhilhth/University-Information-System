async function updateDashboard() {
  const enrolledEl = document.getElementById('enrolled-courses');
  const ongoingEl = document.getElementById('ongoing-courses');
  const completedEl = document.getElementById('completed-courses');
  const coursesGrid = document.querySelector('.courses-grid');

  const API_BASE = window.API_BASE || '';
  const AUTH_TOKEN = window.AUTH_TOKEN || null;
  const STUDENT_ID = window.STUDENT_ID || null;

  const MAX_RECENT = 3;
  const MAX_RETRIES = 2;

  let allCourses = [];
  let controller = null;
  let retryCount = 0;

  // Trạng thái loading và thông báo lỗi
  const loadingEl = createEl('div', 'dashboard-loading', '<span class="spinner"></span> Đang tải...');
  const emptyEl = createEl('div', 'dashboard-empty', 'Không có khóa học để hiển thị.');
  const errorTemplate = `<div class="dashboard-error">Không thể tải dữ liệu. <button class="retry-btn">Thử lại</button></div>`;

  // Tạo phần tử HTML
  function createEl(tag, className, html) {
    const el = document.createElement(tag);
    el.className = className;
    el.innerHTML = html;
    return el;
  }

  function setLoading(isLoading) {
    if (!coursesGrid) return;
    coursesGrid.innerHTML = '';
    if (isLoading) coursesGrid.appendChild(loadingEl);
  }

  function setStatsSkeleton() {
    enrolledEl.textContent = '-';
    ongoingEl.textContent = '-';
    completedEl.textContent = '-';
  }

  function showError() {
    coursesGrid.innerHTML = errorTemplate;
    coursesGrid.querySelector('.retry-btn').onclick = () => {
      retryCount = 0;
      loadDashboard();
    };
  }

  const mockData = {
    enrolled: 12,
    ongoing: 3,
    completed: 9,
    courses: [
      { id: 1, title: 'Giải tích 2', code: 'MT1005', teacher: 'Trần B', term: 'HK241', classId: 'L01', image: '../img/image-47.png' },
      { id: 2, title: 'Hoá đại cương', code: 'CH1003', teacher: 'Lê C', term: 'HK241', classId: 'L01', image: '../img/image-48.png' },
      { id: 3, title: 'Vật lý 1', code: 'PH1003', teacher: 'Nguyễn D', term: 'HK241', classId: 'L01', image: '../img/image-49.png' }
    ]
  };

  // dữ liệu khoá học
  function normalizeCourse(c) {
    return {
      id: c.id ?? c.courseID ?? null,
      title: (c.title ?? c.name ?? '').trim(),
      code: (c.code ?? c.courseID ?? '').trim(),
      teacher: (c.teacher ?? c.instructor ?? '').trim(),
      term: (c.term ?? c.semester ?? '').trim(),
      classId: (c.classId ?? c.class_id ?? '').trim(),
      image: (c.image ?? c.thumbnail ?? '../img/image-47.png').trim()
    };
  }

  // --- RENDER ---
  function updateStats(d) {
    enrolledEl.textContent = String(d.enrolled);
    ongoingEl.textContent = String(d.ongoing);
    completedEl.textContent = String(d.completed);
  }

  function renderCourses(list) {
    coursesGrid.innerHTML = '';

    if (!list.length) {
      coursesGrid.appendChild(emptyEl);
      return;
    }

    const frag = document.createDocumentFragment();

    list.forEach(c => {
      const card = document.createElement('article');
      card.className = 'course-card';
      card.dataset.id = c.id;
      card.tabIndex = 0;

      card.innerHTML = `
        <img class="course-image" src="${c.image}" alt="${c.title}" loading="lazy">
        <div class="course-content">
          <p class="course-description">
            <strong>${c.title}</strong><br>
            <span class="muted">${c.code} - ${c.teacher}</span><br>
            <small class="muted">${c.term} | ${c.classId}</small>
          </p>
        </div>
      `;

      frag.appendChild(card);
    });

    coursesGrid.appendChild(frag);
  }

  // --- FILTER ---
  function filterCourses(keyword) {
    const q = keyword.trim().toLowerCase();

    if (!q) {
      return renderCourses(allCourses.slice(0, MAX_RECENT));
    }

    const filtered = allCourses.filter(c =>
      c.title.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.teacher.toLowerCase().includes(q)
    );

    renderCourses(filtered);
  }

  // Debounce
  function debounce(fn, timeout = 250) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), timeout);
    };
  }

  // --- MAIN LOADER ---
  async function loadDashboard() {
    if (controller) controller.abort();
    controller = new AbortController();

    setLoading(true);
    setStatsSkeleton();

    try {
      const url = `${API_BASE}/api/student/dashboard${STUDENT_ID ? `?studentId=${STUDENT_ID}` : ''}`;

      const res = await fetch(url, {
        signal: controller.signal,
        headers: AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {}
      });

      if (!res.ok) throw new Error(await res.text());

      const data = await res.json();

      const empty = !data?.courses?.length && !(data.enrolled || data.ongoing || data.completed);

      const finalData = empty ? mockData : data;

      updateStats(finalData);
      allCourses = finalData.courses.map(normalizeCourse);

      renderCourses(allCourses.slice(0, MAX_RECENT));

      retryCount = 0;
    } catch (err) {
      if (err.name === 'AbortError') return;

      if (++retryCount <= MAX_RETRIES) {
        return setTimeout(loadDashboard, 2000);
      }

      updateStats(mockData);
      allCourses = mockData.courses.map(normalizeCourse);
      renderCourses(allCourses.slice(0, MAX_RECENT));
    }
  }

  // --- EVENT ---
  const searchInput = document.querySelector('.search-bar input');
  if (searchInput) searchInput.addEventListener('input', debounce(e => filterCourses(e.target.value), 200));

  coursesGrid?.addEventListener('click', (e) => {
    const card = e.target.closest('.course-card');
    if (card?.dataset.id) {
      window.location.href = `${API_BASE}/course.html?id=${card.dataset.id}`;
    }
  });

  // INIT
  loadDashboard();
}

if (typeof window !== 'undefined') window.updateDashboard = updateDashboard;
