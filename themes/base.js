import extend from 'extend';
import Delta from 'rich-text/lib/delta';
import Emitter from '../core/emitter';
import Theme from '../core/theme';
import ColorPicker from '../ui/color-picker';
import IconPicker from '../ui/icon-picker';
import Picker from '../ui/picker';
import Tooltip from '../ui/tooltip';
import icons from '../ui/icons';


const ALIGNS = [ false, 'center', 'right', 'justify' ];

const COLORS = [
  "#000000", "#e60000", "#ff9900", "#ffff00", "#008A00", "#0066cc", "#9933ff",
  "#ffffff", "#facccc", "#ffebcc", "#ffffcc", "#cce8cc", "#cce0f5", "#ebd6ff",
  "#bbbbbb", "#f06666", "#ffc266", "#ffff66", "#66b966", "#66a3e0", "#c285ff",
  "#888888", "#a10000", "#b26b00", "#b2b200", "#006100", "#0047b2", "#6b24b2",
  "#444444", "#5c0000", "#663d00", "#666600", "#003700", "#002966", "#3d1466"
];

const FONTS = [ false, 'serif', 'monospace' ];

const HEADERS = [ '1', '2', '3', false ];

const SIZES = [ 'small', false, 'large', 'huge' ];


class BaseTheme extends Theme {
  constructor(quill, options) {
    super(quill, options);
    this.options.modules.toolbar = this.options.modules.toolbar || {};
    if (this.options.modules.toolbar.constructor !== Object) {
      this.options.modules.toolbar = {
        container: this.options.modules.toolbar,
        handlers: {}
      };
    }
    this.options.modules.toolbar.handlers = extend({},
      BaseTheme.DEFAULTS.modules.toolbar.handlers,
      this.constructor.DEFAULTS.modules.toolbar.handlers || {},
      this.options.modules.toolbar.handlers || {}
    );
    let listener = (e) => {
      if (!document.body.contains(quill.root)) {
        return document.body.removeEventListener('click', listener);
      }
      if (this.tooltip != null && !this.tooltip.root.contains(e.target) &&
          document.activeElement !== this.tooltip.textbox && !this.quill.hasFocus()) {
        this.tooltip.hide();
      }
      if (this.pickers != null) {
        this.pickers.forEach(function(picker) {
          if (!picker.container.contains(e.target)) {
            picker.close();
          }
        });
      }
    };
    document.body.addEventListener('click', listener);
  }

  addModule(name) {
    let module = super.addModule(name);
    if (name === 'toolbar') {
      this.extendToolbar(module);
    }
    return module;
  }

  buildButtons(buttons) {
    buttons.forEach((button) => {
      let className = button.getAttribute('class') || '';
      className.split(/\s+/).forEach((name) => {
        if (!name.startsWith('ql-')) return;
        name = name.slice('ql-'.length);
        if (icons[name] == null) return;
        if (name === 'direction') {
          button.innerHTML = icons[name][''] + icons[name]['rtl'];
        } else if (typeof icons[name] === 'string') {
          button.innerHTML = icons[name];
        } else {
          let value = button.value || '';
          if (value != null && icons[name][value]) {
            button.innerHTML = icons[name][value];
          }
        }
      });
    });
  }

  buildPickers(selects) {
    this.pickers = selects.map((select) => {
      if (select.classList.contains('ql-align')) {
        if (select.querySelector('option') == null) {
          fillSelect(select, ALIGNS);
        }
        return new IconPicker(select, icons.align);
      } else if (select.classList.contains('ql-background') || select.classList.contains('ql-color')) {
        let format = select.classList.contains('ql-background') ? 'background' : 'color';
        if (select.querySelector('option') == null) {
          fillSelect(select, COLORS, format === 'background' ? '#ffffff' : '#000000');
        }
        return new ColorPicker(select, icons[format]);
      } else {
        if (select.querySelector('option') == null) {
          if (select.classList.contains('ql-font')) {
            fillSelect(select, FONTS);
          } else if (select.classList.contains('ql-header')) {
            fillSelect(select, HEADERS);
          } else if (select.classList.contains('ql-size')) {
            fillSelect(select, SIZES);
          }
        }
        return new Picker(select);
      }
    });
    let update = () => {
      this.pickers.forEach(function(picker) {
        picker.update();
      });
    };
    this.quill.on(Emitter.events.SELECTION_CHANGE, update)
              .on(Emitter.events.SCROLL_OPTIMIZE, update);
  }
}
BaseTheme.DEFAULTS = {
  modules: {
    toolbar: {
      handlers: {
        formula: function(value) {
          this.quill.theme.tooltip.edit('formula');
        },
        image: function(value) {
          let fileInput = this.container.querySelector('input.ql-image[type=file]');
          if (fileInput == null) {
            fileInput = document.createElement('input');
            fileInput.setAttribute('type', 'file');
            fileInput.setAttribute('accept', 'image/*');
            fileInput.classList.add('ql-image');
            fileInput.addEventListener('change', () => {
              if (fileInput.files != null && fileInput.files[0] != null) {
                let reader = new FileReader();
                reader.onload = (e) => {
                  let range = this.quill.getSelection(true);
                  this.quill.updateContents(new Delta()
                    .retain(range.index)
                    .delete(range.length)
                    .insert({ image: e.target.result })
                  , Emitter.sources.USER);
                  fileInput.value = "";
                }
                reader.readAsDataURL(fileInput.files[0]);
              }
            });
            this.container.appendChild(fileInput);
          }
          fileInput.click();
        },
        video: function(value) {
          this.quill.theme.tooltip.edit('video');
        }
      }
    }
  }
};


class BaseTooltip extends Tooltip {
  constructor(quill, boundsContainer) {
    super(quill, boundsContainer);
    this.textbox = this.root.querySelector('input[type="text"]');
    this.listen();
  }

  listen() {
    this.textbox.addEventListener('keydown', (event) => {
      if (Keyboard.match(event, 'enter')) {
        this.save();
        event.preventDefault();
      } else if (Keyboard.match(event, 'escape')) {
        this.cancel();
        event.preventDefault();
      }
    });
  }

  cancel() {
    this.hide();
  }

  edit(mode = 'link', preview = null) {
    this.root.classList.remove('ql-hidden');
    this.root.classList.add('ql-editing');
    if (preview != null) {
      this.textbox.value = preview;
    } else if (mode !== this.root.dataset.mode) {
      this.textbox.value = '';
    }
    this.textbox.select();
    this.textbox.setAttribute('placeholder', this.textbox.dataset[mode] || '');
    this.root.dataset.mode = mode;
    this.position(this.quill.getBounds(this.quill.selection.savedRange));
  }

  save() {
    switch(this.root.dataset.mode) {
      case 'link':
        let url = this.textbox.value;
        let scrollTop = this.quill.root.scrollTop;
        if (this.linkRange) {
          this.quill.formatText(this.linkRange, 'link', url, Emitter.sources.USER);
          delete this.linkRange;
        } else {
          this.quill.focus();
          this.quill.format('link', url, Emitter.sources.USER);
        }
        this.quill.root.scrollTop = scrollTop;
        break;
      case 'formula':  // fallthrough
      case 'video':
        let range = this.quill.getSelection(true);
        let index = range.index + range.length;
        if (range != null) {
          this.quill.insertEmbed(index, this.root.dataset.mode, this.textbox.value, Emitter.sources.USER);
          if (this.root.dataset.mode === 'formula') {
            this.quill.insertText(index + 1, ' ', Emitter.sources.USER);
          }
          this.quill.setSelection(index + 2, Emitter.sources.USER);
        }
        break;
      default:
    }
    this.textbox.value = '';
    this.hide();
  }
}


function fillSelect(select, values, defaultValue = false) {
  values.forEach(function(value) {
    let option = document.createElement('option');
    if (value === defaultValue) {
      option.setAttribute('selected', 'selected');
    } else {
      option.setAttribute('value', value);
    }
    select.appendChild(option);
  });
}


export { BaseTooltip, BaseTheme as default };
