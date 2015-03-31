// Source: public/javascripts/vendor/highlight/highlight.js
/*
 Syntax highlighting with language autodetection.
 https://highlightjs.org/
 */

(function (factory) {

    // Setup highlight.js for different environments. First is Node.js or
    // CommonJS.
    if (typeof exports !== 'undefined') {
        factory(exports);
    } else {
        // Export hljs globally even when using AMD for cases when this script
        // is loaded with others that may still expect a global hljs.
        window.hljs = factory({});

        // Finally register the global hljs with AMD.
        if (typeof define === 'function' && define.amd) {
            define([], function () {
                return window.hljs;
            });
        }
    }

}(function (hljs) {

    /* Utility functions */

    function escape(value) {
        return value.replace(/&/gm, '&amp;').replace(/</gm, '&lt;').replace(/>/gm, '&gt;');
    }

    function tag(node) {
        return node.nodeName.toLowerCase();
    }

    function testRe(re, lexeme) {
        var match = re && re.exec(lexeme);
        return match && match.index == 0;
    }

    function blockLanguage(block) {
        var classes = (block.className + ' ' + (block.parentNode ? block.parentNode.className : '')).split(/\s+/);
        classes = classes.map(function (c) {
            return c.replace(/^lang(uage)?-/, '');
        });
        return classes.filter(function (c) {
            return getLanguage(c) || /no(-?)highlight|plain|text/.test(c);
        })[0];
    }

    function inherit(parent, obj) {
        var result = {},
            key;
        for (key in parent)
            result[key] = parent[key];
        if (obj)
            for (key in obj)
                result[key] = obj[key];
        return result;
    }

    /* Stream merging */

    function nodeStream(node) {
        var result = [];
        (function _nodeStream(node, offset) {
            for (var child = node.firstChild; child; child = child.nextSibling) {
                if (child.nodeType == 3)
                    offset += child.nodeValue.length;
                else if (child.nodeType == 1) {
                    result.push({
                        event: 'start',
                        offset: offset,
                        node: child
                    });
                    offset = _nodeStream(child, offset);
                    // Prevent void elements from having an end tag that would actually
                    // double them in the output. There are more void elements in HTML
                    // but we list only those realistically expected in code display.
                    if (!tag(child).match(/br|hr|img|input/)) {
                        result.push({
                            event: 'stop',
                            offset: offset,
                            node: child
                        });
                    }
                }
            }
            return offset;
        })(node, 0);
        return result;
    }

    function mergeStreams(original, highlighted, value) {
        var processed = 0;
        var result = '';
        var nodeStack = [];

        function selectStream() {
            if (!original.length || !highlighted.length) {
                return original.length ? original : highlighted;
            }
            if (original[0].offset != highlighted[0].offset) {
                return (original[0].offset < highlighted[0].offset) ? original : highlighted;
            }

            /*
             To avoid starting the stream just before it should stop the order is
             ensured that original always starts first and closes last:

             if (event1 == 'start' && event2 == 'start')
             return original;
             if (event1 == 'start' && event2 == 'stop')
             return highlighted;
             if (event1 == 'stop' && event2 == 'start')
             return original;
             if (event1 == 'stop' && event2 == 'stop')
             return highlighted;

             ... which is collapsed to:
             */
            return highlighted[0].event == 'start' ? original : highlighted;
        }

        function open(node) {
            function attr_str(a) {
                return ' ' + a.nodeName + '="' + escape(a.value) + '"';
            }

            result += '<' + tag(node) + Array.prototype.map.call(node.attributes, attr_str).join('') + '>';
        }

        function close(node) {
            result += '</' + tag(node) + '>';
        }

        function render(event) {
            (event.event == 'start' ? open : close)(event.node);
        }

        while (original.length || highlighted.length) {
            var stream = selectStream();
            result += escape(value.substr(processed, stream[0].offset - processed));
            processed = stream[0].offset;
            if (stream == original) {
                /*
                 On any opening or closing tag of the original markup we first close
                 the entire highlighted node stack, then render the original tag along
                 with all the following original tags at the same offset and then
                 reopen all the tags on the highlighted stack.
                 */
                nodeStack.reverse().forEach(close);
                do {
                    render(stream.splice(0, 1)[0]);
                    stream = selectStream();
                } while (stream == original && stream.length && stream[0].offset == processed);
                nodeStack.reverse().forEach(open);
            } else {
                if (stream[0].event == 'start') {
                    nodeStack.push(stream[0].node);
                } else {
                    nodeStack.pop();
                }
                render(stream.splice(0, 1)[0]);
            }
        }
        return result + escape(value.substr(processed));
    }

    /* Initialization */

    function compileLanguage(language) {

        function reStr(re) {
            return (re && re.source) || re;
        }

        function langRe(value, global) {
            return new RegExp(
                reStr(value),
                'm' + (language.case_insensitive ? 'i' : '') + (global ? 'g' : '')
            );
        }

        function compileMode(mode, parent) {
            if (mode.compiled)
                return;
            mode.compiled = true;

            mode.keywords = mode.keywords || mode.beginKeywords;
            if (mode.keywords) {
                var compiled_keywords = {};

                var flatten = function (className, str) {
                    if (language.case_insensitive) {
                        str = str.toLowerCase();
                    }
                    str.split(' ').forEach(function (kw) {
                        var pair = kw.split('|');
                        compiled_keywords[pair[0]] = [className, pair[1] ? Number(pair[1]) : 1];
                    });
                };

                if (typeof mode.keywords == 'string') { // string
                    flatten('keyword', mode.keywords);
                } else {
                    Object.keys(mode.keywords).forEach(function (className) {
                        flatten(className, mode.keywords[className]);
                    });
                }
                mode.keywords = compiled_keywords;
            }
            mode.lexemesRe = langRe(mode.lexemes || /\b\w+\b/, true);

            if (parent) {
                if (mode.beginKeywords) {
                    mode.begin = '\\b(' + mode.beginKeywords.split(' ').join('|') + ')\\b';
                }
                if (!mode.begin)
                    mode.begin = /\B|\b/;
                mode.beginRe = langRe(mode.begin);
                if (!mode.end && !mode.endsWithParent)
                    mode.end = /\B|\b/;
                if (mode.end)
                    mode.endRe = langRe(mode.end);
                mode.terminator_end = reStr(mode.end) || '';
                if (mode.endsWithParent && parent.terminator_end)
                    mode.terminator_end += (mode.end ? '|' : '') + parent.terminator_end;
            }
            if (mode.illegal)
                mode.illegalRe = langRe(mode.illegal);
            if (mode.relevance === undefined)
                mode.relevance = 1;
            if (!mode.contains) {
                mode.contains = [];
            }
            var expanded_contains = [];
            mode.contains.forEach(function (c) {
                if (c.variants) {
                    c.variants.forEach(function (v) {
                        expanded_contains.push(inherit(c, v));
                    });
                } else {
                    expanded_contains.push(c == 'self' ? mode : c);
                }
            });
            mode.contains = expanded_contains;
            mode.contains.forEach(function (c) {
                compileMode(c, mode);
            });

            if (mode.starts) {
                compileMode(mode.starts, parent);
            }

            var terminators =
                mode.contains.map(function (c) {
                    return c.beginKeywords ? '\\.?(' + c.begin + ')\\.?' : c.begin;
                })
                    .concat([mode.terminator_end, mode.illegal])
                    .map(reStr)
                    .filter(Boolean);
            mode.terminators = terminators.length ? langRe(terminators.join('|'), true) : {
                exec: function (/*s*/) {
                    return null;
                }
            };
        }

        compileMode(language);
    }

    /*
     Core highlighting function. Accepts a language name, or an alias, and a
     string with the code to highlight. Returns an object with the following
     properties:

     - relevance (int)
     - value (an HTML string with highlighting markup)

     */
    function highlight(name, value, ignore_illegals, continuation) {

        function subMode(lexeme, mode) {
            for (var i = 0; i < mode.contains.length; i++) {
                if (testRe(mode.contains[i].beginRe, lexeme)) {
                    return mode.contains[i];
                }
            }
        }

        function endOfMode(mode, lexeme) {
            if (testRe(mode.endRe, lexeme)) {
                return mode;
            }
            if (mode.endsWithParent) {
                return endOfMode(mode.parent, lexeme);
            }
        }

        function isIllegal(lexeme, mode) {
            return !ignore_illegals && testRe(mode.illegalRe, lexeme);
        }

        function keywordMatch(mode, match) {
            var match_str = language.case_insensitive ? match[0].toLowerCase() : match[0];
            return mode.keywords.hasOwnProperty(match_str) && mode.keywords[match_str];
        }

        function buildSpan(classname, insideSpan, leaveOpen, noPrefix) {
            var classPrefix = noPrefix ? '' : options.classPrefix,
                openSpan = '<span class="' + classPrefix,
                closeSpan = leaveOpen ? '' : '</span>';

            openSpan += classname + '">';

            return openSpan + insideSpan + closeSpan;
        }

        function processKeywords() {
            if (!top.keywords)
                return escape(mode_buffer);
            var result = '';
            var last_index = 0;
            top.lexemesRe.lastIndex = 0;
            var match = top.lexemesRe.exec(mode_buffer);
            while (match) {
                result += escape(mode_buffer.substr(last_index, match.index - last_index));
                var keyword_match = keywordMatch(top, match);
                if (keyword_match) {
                    relevance += keyword_match[1];
                    result += buildSpan(keyword_match[0], escape(match[0]));
                } else {
                    result += escape(match[0]);
                }
                last_index = top.lexemesRe.lastIndex;
                match = top.lexemesRe.exec(mode_buffer);
            }
            return result + escape(mode_buffer.substr(last_index));
        }

        function processSubLanguage() {
            if (top.subLanguage && !languages[top.subLanguage]) {
                return escape(mode_buffer);
            }
            var result = top.subLanguage ? highlight(top.subLanguage, mode_buffer, true, continuations[top.subLanguage]) : highlightAuto(mode_buffer);
            // Counting embedded language score towards the host language may be disabled
            // with zeroing the containing mode relevance. Usecase in point is Markdown that
            // allows XML everywhere and makes every XML snippet to have a much larger Markdown
            // score.
            if (top.relevance > 0) {
                relevance += result.relevance;
            }
            if (top.subLanguageMode == 'continuous') {
                continuations[top.subLanguage] = result.top;
            }
            return buildSpan(result.language, result.value, false, true);
        }

        function processBuffer() {
            return top.subLanguage !== undefined ? processSubLanguage() : processKeywords();
        }

        function startNewMode(mode, lexeme) {
            var markup = mode.className ? buildSpan(mode.className, '', true) : '';
            if (mode.returnBegin) {
                result += markup;
                mode_buffer = '';
            } else if (mode.excludeBegin) {
                result += escape(lexeme) + markup;
                mode_buffer = '';
            } else {
                result += markup;
                mode_buffer = lexeme;
            }
            top = Object.create(mode, {
                parent: {
                    value: top
                }
            });
        }

        function processLexeme(buffer, lexeme) {

            mode_buffer += buffer;
            if (lexeme === undefined) {
                result += processBuffer();
                return 0;
            }

            var new_mode = subMode(lexeme, top);
            if (new_mode) {
                result += processBuffer();
                startNewMode(new_mode, lexeme);
                return new_mode.returnBegin ? 0 : lexeme.length;
            }

            var end_mode = endOfMode(top, lexeme);
            if (end_mode) {
                var origin = top;
                if (!(origin.returnEnd || origin.excludeEnd)) {
                    mode_buffer += lexeme;
                }
                result += processBuffer();
                do {
                    if (top.className) {
                        result += '</span>';
                    }
                    relevance += top.relevance;
                    top = top.parent;
                } while (top != end_mode.parent);
                if (origin.excludeEnd) {
                    result += escape(lexeme);
                }
                mode_buffer = '';
                if (end_mode.starts) {
                    startNewMode(end_mode.starts, '');
                }
                return origin.returnEnd ? 0 : lexeme.length;
            }

            if (isIllegal(lexeme, top))
                throw new Error('Illegal lexeme "' + lexeme + '" for mode "' + (top.className || '<unnamed>') + '"');

            /*
             Parser should not reach this point as all types of lexemes should be caught
             earlier, but if it does due to some bug make sure it advances at least one
             character forward to prevent infinite looping.
             */
            mode_buffer += lexeme;
            return lexeme.length || 1;
        }

        var language = getLanguage(name);
        if (!language) {
            throw new Error('Unknown language: "' + name + '"');
        }

        compileLanguage(language);
        var top = continuation || language;
        var continuations = {}; // keep continuations for sub-languages
        var result = '',
            current;
        for (current = top; current != language; current = current.parent) {
            if (current.className) {
                result = buildSpan(current.className, '', true) + result;
            }
        }
        var mode_buffer = '';
        var relevance = 0;
        try {
            var match, count, index = 0;
            while (true) {
                top.terminators.lastIndex = index;
                match = top.terminators.exec(value);
                if (!match)
                    break;
                count = processLexeme(value.substr(index, match.index - index), match[0]);
                index = match.index + count;
            }
            processLexeme(value.substr(index));
            for (current = top; current.parent; current = current.parent) { // close dangling modes
                if (current.className) {
                    result += '</span>';
                }
            }
            return {
                relevance: relevance,
                value: result,
                language: name,
                top: top
            };
        } catch (e) {
            if (e.message.indexOf('Illegal') != -1) {
                return {
                    relevance: 0,
                    value: escape(value)
                };
            } else {
                throw e;
            }
        }
    }

    /*
     Highlighting with language detection. Accepts a string with the code to
     highlight. Returns an object with the following properties:

     - language (detected language)
     - relevance (int)
     - value (an HTML string with highlighting markup)
     - second_best (object with the same structure for second-best heuristically
     detected language, may be absent)

     */
    function highlightAuto(text, languageSubset) {
        languageSubset = languageSubset || options.languages || Object.keys(languages);
        var result = {
            relevance: 0,
            value: escape(text)
        };
        var second_best = result;
        languageSubset.forEach(function (name) {
            if (!getLanguage(name)) {
                return;
            }
            var current = highlight(name, text, false);
            current.language = name;
            if (current.relevance > second_best.relevance) {
                second_best = current;
            }
            if (current.relevance > result.relevance) {
                second_best = result;
                result = current;
            }
        });
        if (second_best.language) {
            result.second_best = second_best;
        }
        return result;
    }

    /*
     Post-processing of the highlighted markup:

     - replace TABs with something more useful
     - replace real line-breaks with '<br>' for non-pre containers

     */
    function fixMarkup(value) {
        if (options.tabReplace) {
            value = value.replace(/^((<[^>]+>|\t)+)/gm, function (match, p1 /*..., offset, s*/) {
                return p1.replace(/\t/g, options.tabReplace);
            });
        }
        if (options.useBR) {
            value = value.replace(/\n/g, '<br>');
        }
        return value;
    }

    function buildClassName(prevClassName, currentLang, resultLang) {
        var language = currentLang ? aliases[currentLang] : resultLang,
            result = [prevClassName.trim()];

        if (!prevClassName.match(/\bhljs\b/)) {
            result.push('hljs');
        }

        if (prevClassName.indexOf(language) === -1) {
            result.push(language);
        }

        return result.join(' ').trim();
    }

    /*
     Applies highlighting to a DOM node containing code. Accepts a DOM node and
     two optional parameters for fixMarkup.
     */
    function highlightBlock(block) {
        var language = blockLanguage(block);
        if (/no(-?)highlight|plain|text/.test(language))
            return;

        var node;
        if (options.useBR) {
            node = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
            node.innerHTML = block.innerHTML.replace(/\n/g, '').replace(/<br[ \/]*>/g, '\n');
        } else {
            node = block;
        }
        var text = node.textContent;
        var result = language ? highlight(language, text, true) : highlightAuto(text);

        var originalStream = nodeStream(node);
        if (originalStream.length) {
            var resultNode = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
            resultNode.innerHTML = result.value;
            result.value = mergeStreams(originalStream, nodeStream(resultNode), text);
        }
        result.value = fixMarkup(result.value);

        block.innerHTML = result.value;
        block.className = buildClassName(block.className, language, result.language);
        block.result = {
            language: result.language,
            re: result.relevance
        };
        if (result.second_best) {
            block.second_best = {
                language: result.second_best.language,
                re: result.second_best.relevance
            };
        }
    }

    var options = {
        classPrefix: 'hljs-',
        tabReplace: null,
        useBR: false,
        languages: undefined
    };

    /*
     Updates highlight.js global options with values passed in the form of an object
     */
    function configure(user_options) {
        options = inherit(options, user_options);
    }

    /*
     Applies highlighting to all <pre><code>..</code></pre> blocks on a page.
     */
    function initHighlighting() {
        if (initHighlighting.called)
            return;
        initHighlighting.called = true;

        var blocks = document.querySelectorAll('pre code');
        Array.prototype.forEach.call(blocks, highlightBlock);
    }

    /*
     Attaches highlighting to the page load event.
     */
    function initHighlightingOnLoad() {
        addEventListener('DOMContentLoaded', initHighlighting, false);
        addEventListener('load', initHighlighting, false);
    }

    var languages = {};
    var aliases = {};

    function registerLanguage(name, language) {
        var lang = languages[name] = language(hljs);
        if (lang.aliases) {
            lang.aliases.forEach(function (alias) {
                aliases[alias] = name;
            });
        }
    }

    function listLanguages() {
        return Object.keys(languages);
    }

    function getLanguage(name) {
        return languages[name] || languages[aliases[name]];
    }

    /* Interface definition */

    hljs.highlight = highlight;
    hljs.highlightAuto = highlightAuto;
    hljs.fixMarkup = fixMarkup;
    hljs.highlightBlock = highlightBlock;
    hljs.configure = configure;
    hljs.initHighlighting = initHighlighting;
    hljs.initHighlightingOnLoad = initHighlightingOnLoad;
    hljs.registerLanguage = registerLanguage;
    hljs.listLanguages = listLanguages;
    hljs.getLanguage = getLanguage;
    hljs.inherit = inherit;

    // Common regexps
    hljs.IDENT_RE = '[a-zA-Z]\\w*';
    hljs.UNDERSCORE_IDENT_RE = '[a-zA-Z_]\\w*';
    hljs.NUMBER_RE = '\\b\\d+(\\.\\d+)?';
    hljs.C_NUMBER_RE = '\\b(0[xX][a-fA-F0-9]+|(\\d+(\\.\\d*)?|\\.\\d+)([eE][-+]?\\d+)?)'; // 0x..., 0..., decimal, float
    hljs.BINARY_NUMBER_RE = '\\b(0b[01]+)'; // 0b...
    hljs.RE_STARTERS_RE = '!|!=|!==|%|%=|&|&&|&=|\\*|\\*=|\\+|\\+=|,|-|-=|/=|/|:|;|<<|<<=|<=|<|===|==|=|>>>=|>>=|>=|>>>|>>|>|\\?|\\[|\\{|\\(|\\^|\\^=|\\||\\|=|\\|\\||~';

    // Common modes
    hljs.BACKSLASH_ESCAPE = {
        begin: '\\\\[\\s\\S]',
        relevance: 0
    };
    hljs.APOS_STRING_MODE = {
        className: 'string',
        begin: '\'',
        end: '\'',
        illegal: '\\n',
        contains: [hljs.BACKSLASH_ESCAPE]
    };
    hljs.QUOTE_STRING_MODE = {
        className: 'string',
        begin: '"',
        end: '"',
        illegal: '\\n',
        contains: [hljs.BACKSLASH_ESCAPE]
    };
    hljs.PHRASAL_WORDS_MODE = {
        begin: /\b(a|an|the|are|I|I'm|isn't|don't|doesn't|won't|but|just|should|pretty|simply|enough|gonna|going|wtf|so|such)\b/
    };
    hljs.C_LINE_COMMENT_MODE = {
        className: 'comment',
        begin: '//',
        end: '$',
        contains: [hljs.PHRASAL_WORDS_MODE]
    };
    hljs.C_BLOCK_COMMENT_MODE = {
        className: 'comment',
        begin: '/\\*',
        end: '\\*/',
        contains: [hljs.PHRASAL_WORDS_MODE]
    };
    hljs.HASH_COMMENT_MODE = {
        className: 'comment',
        begin: '#',
        end: '$',
        contains: [hljs.PHRASAL_WORDS_MODE]
    };
    hljs.NUMBER_MODE = {
        className: 'number',
        begin: hljs.NUMBER_RE,
        relevance: 0
    };
    hljs.C_NUMBER_MODE = {
        className: 'number',
        begin: hljs.C_NUMBER_RE,
        relevance: 0
    };
    hljs.BINARY_NUMBER_MODE = {
        className: 'number',
        begin: hljs.BINARY_NUMBER_RE,
        relevance: 0
    };
    hljs.CSS_NUMBER_MODE = {
        className: 'number',
        begin: hljs.NUMBER_RE + '(' +
        '%|em|ex|ch|rem' +
        '|vw|vh|vmin|vmax' +
        '|cm|mm|in|pt|pc|px' +
        '|deg|grad|rad|turn' +
        '|s|ms' +
        '|Hz|kHz' +
        '|dpi|dpcm|dppx' +
        ')?',
        relevance: 0
    };
    hljs.REGEXP_MODE = {
        className: 'regexp',
        begin: /\//,
        end: /\/[gimuy]*/,
        illegal: /\n/,
        contains: [
            hljs.BACKSLASH_ESCAPE, {
                begin: /\[/,
                end: /\]/,
                relevance: 0,
                contains: [hljs.BACKSLASH_ESCAPE]
            }
        ]
    };
    hljs.TITLE_MODE = {
        className: 'title',
        begin: hljs.IDENT_RE,
        relevance: 0
    };
    hljs.UNDERSCORE_TITLE_MODE = {
        className: 'title',
        begin: hljs.UNDERSCORE_IDENT_RE,
        relevance: 0
    };

    return hljs;
}));

hljs.registerLanguage('1c', function (hljs) {
    var IDENT_RE_RU = '[a-zA-Zа-яА-Я][a-zA-Z0-9_а-яА-Я]*';
    var OneS_KEYWORDS = 'возврат дата для если и или иначе иначеесли исключение конецесли ' +
        'конецпопытки конецпроцедуры конецфункции конеццикла константа не перейти перем ' +
        'перечисление по пока попытка прервать продолжить процедура строка тогда фс функция цикл ' +
        'число экспорт';
    var OneS_BUILT_IN = 'ansitooem oemtoansi ввестивидсубконто ввестидату ввестизначение ' +
        'ввестиперечисление ввестипериод ввестиплансчетов ввестистроку ввестичисло вопрос ' +
        'восстановитьзначение врег выбранныйплансчетов вызватьисключение датагод датамесяц ' +
        'датачисло добавитьмесяц завершитьработусистемы заголовоксистемы записьжурналарегистрации ' +
        'запуститьприложение зафиксироватьтранзакцию значениевстроку значениевстрокувнутр ' +
        'значениевфайл значениеизстроки значениеизстрокивнутр значениеизфайла имякомпьютера ' +
        'имяпользователя каталогвременныхфайлов каталогиб каталогпользователя каталогпрограммы ' +
        'кодсимв командасистемы конгода конецпериодаби конецрассчитанногопериодаби ' +
        'конецстандартногоинтервала конквартала конмесяца коннедели лев лог лог10 макс ' +
        'максимальноеколичествосубконто мин монопольныйрежим названиеинтерфейса названиенабораправ ' +
        'назначитьвид назначитьсчет найти найтипомеченныенаудаление найтиссылки началопериодаби ' +
        'началостандартногоинтервала начатьтранзакцию начгода начквартала начмесяца начнедели ' +
        'номерднягода номерднянедели номернеделигода нрег обработкаожидания окр описаниеошибки ' +
        'основнойжурналрасчетов основнойплансчетов основнойязык открытьформу открытьформумодально ' +
        'отменитьтранзакцию очиститьокносообщений периодстр полноеимяпользователя получитьвремята ' +
        'получитьдатута получитьдокументта получитьзначенияотбора получитьпозициюта ' +
        'получитьпустоезначение получитьта прав праводоступа предупреждение префиксавтонумерации ' +
        'пустаястрока пустоезначение рабочаядаттьпустоезначение рабочаядата разделительстраниц ' +
        'разделительстрок разм разобратьпозициюдокумента рассчитатьрегистрына ' +
        'рассчитатьрегистрыпо сигнал симв символтабуляции создатьобъект сокрл сокрлп сокрп ' +
        'сообщить состояние сохранитьзначение сред статусвозврата стрдлина стрзаменить ' +
        'стрколичествострок стрполучитьстроку  стрчисловхождений сформироватьпозициюдокумента ' +
        'счетпокоду текущаядата текущеевремя типзначения типзначениястр удалитьобъекты ' +
        'установитьтана установитьтапо фиксшаблон формат цел шаблон';
    var DQUOTE = {
        className: 'dquote',
        begin: '""'
    };
    var STR_START = {
        className: 'string',
        begin: '"',
        end: '"|$',
        contains: [DQUOTE]
    };
    var STR_CONT = {
        className: 'string',
        begin: '\\|',
        end: '"|$',
        contains: [DQUOTE]
    };

    return {
        case_insensitive: true,
        lexemes: IDENT_RE_RU,
        keywords: {
            keyword: OneS_KEYWORDS,
            built_in: OneS_BUILT_IN
        },
        contains: [
            hljs.C_LINE_COMMENT_MODE,
            hljs.NUMBER_MODE,
            STR_START, STR_CONT, {
                className: 'function',
                begin: '(процедура|функция)',
                end: '$',
                lexemes: IDENT_RE_RU,
                keywords: 'процедура функция',
                contains: [
                    hljs.inherit(hljs.TITLE_MODE, {
                        begin: IDENT_RE_RU
                    }), {
                        className: 'tail',
                        endsWithParent: true,
                        contains: [{
                            className: 'params',
                            begin: '\\(',
                            end: '\\)',
                            lexemes: IDENT_RE_RU,
                            keywords: 'знач',
                            contains: [STR_START, STR_CONT]
                        }, {
                            className: 'export',
                            begin: 'экспорт',
                            endsWithParent: true,
                            lexemes: IDENT_RE_RU,
                            keywords: 'экспорт',
                            contains: [hljs.C_LINE_COMMENT_MODE]
                        }]
                    },
                    hljs.C_LINE_COMMENT_MODE
                ]
            }, {
                className: 'preprocessor',
                begin: '#',
                end: '$'
            }, {
                className: 'date',
                begin: '\'\\d{2}\\.\\d{2}\\.(\\d{2}|\\d{4})\''
            }
        ]
    };
});
hljs.registerLanguage('actionscript', function (hljs) {
    var IDENT_RE = '[a-zA-Z_$][a-zA-Z0-9_$]*';
    var IDENT_FUNC_RETURN_TYPE_RE = '([*]|[a-zA-Z_$][a-zA-Z0-9_$]*)';

    var AS3_REST_ARG_MODE = {
        className: 'rest_arg',
        begin: '[.]{3}',
        end: IDENT_RE,
        relevance: 10
    };

    return {
        aliases: ['as'],
        keywords: {
            keyword: 'as break case catch class const continue default delete do dynamic each ' +
            'else extends final finally for function get if implements import in include ' +
            'instanceof interface internal is namespace native new override package private ' +
            'protected public return set static super switch this throw try typeof use var void ' +
            'while with',
            literal: 'true false null undefined'
        },
        contains: [
            hljs.APOS_STRING_MODE,
            hljs.QUOTE_STRING_MODE,
            hljs.C_LINE_COMMENT_MODE,
            hljs.C_BLOCK_COMMENT_MODE,
            hljs.C_NUMBER_MODE, {
                className: 'package',
                beginKeywords: 'package',
                end: '{',
                contains: [hljs.TITLE_MODE]
            }, {
                className: 'class',
                beginKeywords: 'class interface',
                end: '{',
                excludeEnd: true,
                contains: [{
                    beginKeywords: 'extends implements'
                },
                    hljs.TITLE_MODE
                ]
            }, {
                className: 'preprocessor',
                beginKeywords: 'import include',
                end: ';'
            }, {
                className: 'function',
                beginKeywords: 'function',
                end: '[{;]',
                excludeEnd: true,
                illegal: '\\S',
                contains: [
                    hljs.TITLE_MODE, {
                        className: 'params',
                        begin: '\\(',
                        end: '\\)',
                        contains: [
                            hljs.APOS_STRING_MODE,
                            hljs.QUOTE_STRING_MODE,
                            hljs.C_LINE_COMMENT_MODE,
                            hljs.C_BLOCK_COMMENT_MODE,
                            AS3_REST_ARG_MODE
                        ]
                    }, {
                        className: 'type',
                        begin: ':',
                        end: IDENT_FUNC_RETURN_TYPE_RE,
                        relevance: 10
                    }
                ]
            }
        ]
    };
});
hljs.registerLanguage('apache', function (hljs) {
    var NUMBER = {
        className: 'number',
        begin: '[\\$%]\\d+'
    };
    return {
        aliases: ['apacheconf'],
        case_insensitive: true,
        contains: [
            hljs.HASH_COMMENT_MODE, {
                className: 'tag',
                begin: '</?',
                end: '>'
            }, {
                className: 'keyword',
                begin: /\w+/,
                relevance: 0,
                // keywords aren’t needed for highlighting per se, they only boost relevance
                // for a very generally defined mode (starts with a word, ends with line-end
                keywords: {
                    common: 'order deny allow setenv rewriterule rewriteengine rewritecond documentroot ' +
                    'sethandler errordocument loadmodule options header listen serverroot ' +
                    'servername'
                },
                starts: {
                    end: /$/,
                    relevance: 0,
                    keywords: {
                        literal: 'on off all'
                    },
                    contains: [{
                        className: 'sqbracket',
                        begin: '\\s\\[',
                        end: '\\]$'
                    }, {
                        className: 'cbracket',
                        begin: '[\\$%]\\{',
                        end: '\\}',
                        contains: ['self', NUMBER]
                    },
                        NUMBER,
                        hljs.QUOTE_STRING_MODE
                    ]
                }
            }
        ],
        illegal: /\S/
    };
});
hljs.registerLanguage('applescript', function (hljs) {
    var STRING = hljs.inherit(hljs.QUOTE_STRING_MODE, {
        illegal: ''
    });
    var PARAMS = {
        className: 'params',
        begin: '\\(',
        end: '\\)',
        contains: ['self', hljs.C_NUMBER_MODE, STRING]
    };
    var COMMENTS = [{
        className: 'comment',
        begin: '--',
        end: '$'
    }, {
        className: 'comment',
        begin: '\\(\\*',
        end: '\\*\\)',
        contains: ['self', {
            begin: '--',
            end: '$'
        }] //allow nesting
    },
        hljs.HASH_COMMENT_MODE
    ];

    return {
        aliases: ['osascript'],
        keywords: {
            keyword: 'about above after against and around as at back before beginning ' +
            'behind below beneath beside between but by considering ' +
            'contain contains continue copy div does eighth else end equal ' +
            'equals error every exit fifth first for fourth from front ' +
            'get given global if ignoring in into is it its last local me ' +
            'middle mod my ninth not of on onto or over prop property put ref ' +
            'reference repeat returning script second set seventh since ' +
            'sixth some tell tenth that the|0 then third through thru ' +
            'timeout times to transaction try until where while whose with ' +
            'without',
            constant: 'AppleScript false linefeed return pi quote result space tab true',
            type: 'alias application boolean class constant date file integer list ' +
            'number real record string text',
            command: 'activate beep count delay launch log offset read round ' +
            'run say summarize write',
            property: 'character characters contents day frontmost id item length ' +
            'month name paragraph paragraphs rest reverse running time version ' +
            'weekday word words year'
        },
        contains: [
            STRING,
            hljs.C_NUMBER_MODE, {
                className: 'type',
                begin: '\\bPOSIX file\\b'
            }, {
                className: 'command',
                begin: '\\b(clipboard info|the clipboard|info for|list (disks|folder)|' +
                'mount volume|path to|(close|open for) access|(get|set) eof|' +
                'current date|do shell script|get volume settings|random number|' +
                'set volume|system attribute|system info|time to GMT|' +
                '(load|run|store) script|scripting components|' +
                'ASCII (character|number)|localized string|' +
                'choose (application|color|file|file name|' +
                'folder|from list|remote application|URL)|' +
                'display (alert|dialog))\\b|^\\s*return\\b'
            }, {
                className: 'constant',
                begin: '\\b(text item delimiters|current application|missing value)\\b'
            }, {
                className: 'keyword',
                begin: '\\b(apart from|aside from|instead of|out of|greater than|' +
                "isn't|(doesn't|does not) (equal|come before|come after|contain)|" +
                '(greater|less) than( or equal)?|(starts?|ends|begins?) with|' +
                'contained by|comes (before|after)|a (ref|reference))\\b'
            }, {
                className: 'property',
                begin: '\\b(POSIX path|(date|time) string|quoted form)\\b'
            }, {
                className: 'function_start',
                beginKeywords: 'on',
                illegal: '[${=;\\n]',
                contains: [hljs.UNDERSCORE_TITLE_MODE, PARAMS]
            }
        ].concat(COMMENTS),
        illegal: '//|->|=>'
    };
});
hljs.registerLanguage('xml', function (hljs) {
    var XML_IDENT_RE = '[A-Za-z0-9\\._:-]+';
    var PHP = {
        begin: /<\?(php)?(?!\w)/,
        end: /\?>/,
        subLanguage: 'php',
        subLanguageMode: 'continuous'
    };
    var TAG_INTERNALS = {
        endsWithParent: true,
        illegal: /</,
        relevance: 0,
        contains: [
            PHP, {
                className: 'attribute',
                begin: XML_IDENT_RE,
                relevance: 0
            }, {
                begin: '=',
                relevance: 0,
                contains: [{
                    className: 'value',
                    contains: [PHP],
                    variants: [{
                        begin: /"/,
                        end: /"/
                    }, {
                        begin: /'/,
                        end: /'/
                    }, {
                        begin: /[^\s\/>]+/
                    }]
                }]
            }
        ]
    };
    return {
        aliases: ['html', 'xhtml', 'rss', 'atom', 'xsl', 'plist'],
        case_insensitive: true,
        contains: [{
            className: 'doctype',
            begin: '<!DOCTYPE',
            end: '>',
            relevance: 10,
            contains: [{
                begin: '\\[',
                end: '\\]'
            }]
        }, {
            className: 'comment',
            begin: '<!--',
            end: '-->',
            relevance: 10
        }, {
            className: 'cdata',
            begin: '<\\!\\[CDATA\\[',
            end: '\\]\\]>',
            relevance: 10
        }, {
            className: 'tag',
            /*
             The lookahead pattern (?=...) ensures that 'begin' only matches
             '<style' as a single word, followed by a whitespace or an
             ending braket. The '$' is needed for the lexeme to be recognized
             by hljs.subMode() that tests lexemes outside the stream.
             */
            begin: '<style(?=\\s|>|$)',
            end: '>',
            keywords: {
                title: 'style'
            },
            contains: [TAG_INTERNALS],
            starts: {
                end: '</style>',
                returnEnd: true,
                subLanguage: 'css'
            }
        }, {
            className: 'tag',
            // See the comment in the <style tag about the lookahead pattern
            begin: '<script(?=\\s|>|$)',
            end: '>',
            keywords: {
                title: 'script'
            },
            contains: [TAG_INTERNALS],
            starts: {
                end: '</script>',
                returnEnd: true,
                subLanguage: ''
            }
        },
            PHP, {
                className: 'pi',
                begin: /<\?\w+/,
                end: /\?>/,
                relevance: 10
            }, {
                className: 'tag',
                begin: '</?',
                end: '/?>',
                contains: [{
                    className: 'title',
                    begin: /[^ \/><\n\t]+/,
                    relevance: 0
                },
                    TAG_INTERNALS
                ]
            }
        ]
    };
});
hljs.registerLanguage('asciidoc', function (hljs) {
    return {
        aliases: ['adoc'],
        contains: [
            // block comment
            {
                className: 'comment',
                begin: '^/{4,}\\n',
                end: '\\n/{4,}$',
                // can also be done as...
                //begin: '^/{4,}$',
                //end: '^/{4,}$',
                relevance: 10
            },
            // line comment
            {
                className: 'comment',
                begin: '^//',
                end: '$',
                relevance: 0
            },
            // title
            {
                className: 'title',
                begin: '^\\.\\w.*$'
            },
            // example, admonition & sidebar blocks
            {
                begin: '^[=\\*]{4,}\\n',
                end: '\\n^[=\\*]{4,}$',
                relevance: 10
            },
            // headings
            {
                className: 'header',
                begin: '^(={1,5}) .+?( \\1)?$',
                relevance: 10
            }, {
                className: 'header',
                begin: '^[^\\[\\]\\n]+?\\n[=\\-~\\^\\+]{2,}$',
                relevance: 10
            },
            // document attributes
            {
                className: 'attribute',
                begin: '^:.+?:',
                end: '\\s',
                excludeEnd: true,
                relevance: 10
            },
            // block attributes
            {
                className: 'attribute',
                begin: '^\\[.+?\\]$',
                relevance: 0
            },
            // quoteblocks
            {
                className: 'blockquote',
                begin: '^_{4,}\\n',
                end: '\\n_{4,}$',
                relevance: 10
            },
            // listing and literal blocks
            {
                className: 'code',
                begin: '^[\\-\\.]{4,}\\n',
                end: '\\n[\\-\\.]{4,}$',
                relevance: 10
            },
            // passthrough blocks
            {
                begin: '^\\+{4,}\\n',
                end: '\\n\\+{4,}$',
                contains: [{
                    begin: '<',
                    end: '>',
                    subLanguage: 'xml',
                    relevance: 0
                }],
                relevance: 10
            },
            // lists (can only capture indicators)
            {
                className: 'bullet',
                begin: '^(\\*+|\\-+|\\.+|[^\\n]+?::)\\s+'
            },
            // admonition
            {
                className: 'label',
                begin: '^(NOTE|TIP|IMPORTANT|WARNING|CAUTION):\\s+',
                relevance: 10
            },
            // inline strong
            {
                className: 'strong',
                // must not follow a word character or be followed by an asterisk or space
                begin: '\\B\\*(?![\\*\\s])',
                end: '(\\n{2}|\\*)',
                // allow escaped asterisk followed by word char
                contains: [{
                    begin: '\\\\*\\w',
                    relevance: 0
                }]
            },
            // inline emphasis
            {
                className: 'emphasis',
                // must not follow a word character or be followed by a single quote or space
                begin: '\\B\'(?![\'\\s])',
                end: '(\\n{2}|\')',
                // allow escaped single quote followed by word char
                contains: [{
                    begin: '\\\\\'\\w',
                    relevance: 0
                }],
                relevance: 0
            },
            // inline emphasis (alt)
            {
                className: 'emphasis',
                // must not follow a word character or be followed by an underline or space
                begin: '_(?![_\\s])',
                end: '(\\n{2}|_)',
                relevance: 0
            },
            // inline smart quotes
            {
                className: 'smartquote',
                variants: [{
                    begin: "``.+?''"
                }, {
                    begin: "`.+?'"
                }]
            },
            // inline code snippets (TODO should get same treatment as strong and emphasis)
            {
                className: 'code',
                begin: '(`.+?`|\\+.+?\\+)',
                relevance: 0
            },
            // indented literal block
            {
                className: 'code',
                begin: '^[ \\t]',
                end: '$',
                relevance: 0
            },
            // horizontal rules
            {
                className: 'horizontal_rule',
                begin: '^\'{3,}[ \\t]*$',
                relevance: 10
            },
            // images and links
            {
                begin: '(link:)?(http|https|ftp|file|irc|image:?):\\S+\\[.*?\\]',
                returnBegin: true,
                contains: [{
                    //className: 'macro',
                    begin: '(link|image:?):',
                    relevance: 0
                }, {
                    className: 'link_url',
                    begin: '\\w',
                    end: '[^\\[]+',
                    relevance: 0
                }, {
                    className: 'link_label',
                    begin: '\\[',
                    end: '\\]',
                    excludeBegin: true,
                    excludeEnd: true,
                    relevance: 0
                }],
                relevance: 10
            }
        ]
    };
});
hljs.registerLanguage('aspectj', function (hljs) {
    var KEYWORDS =
        'false synchronized int abstract float private char boolean static null if const ' +
        'for true while long throw strictfp finally protected import native final return void ' +
        'enum else extends implements break transient new catch instanceof byte super volatile case ' +
        'assert short package default double public try this switch continue throws privileged ' +
        'aspectOf adviceexecution proceed cflowbelow cflow initialization preinitialization ' +
        'staticinitialization withincode target within execution getWithinTypeName handler ' +
        'thisJoinPoint thisJoinPointStaticPart thisEnclosingJoinPointStaticPart declare parents ' +
        'warning error soft precedence thisAspectInstance';
    var SHORTKEYS = 'get set args call';
    return {
        keywords: KEYWORDS,
        illegal: /<\//,
        contains: [{
            className: 'javadoc',
            begin: '/\\*\\*',
            end: '\\*/',
            relevance: 0,
            contains: [{
                className: 'javadoctag',
                begin: '(^|\\s)@[A-Za-z]+'
            }]
        },
            hljs.C_LINE_COMMENT_MODE,
            hljs.C_BLOCK_COMMENT_MODE,
            hljs.APOS_STRING_MODE,
            hljs.QUOTE_STRING_MODE, {
                className: 'aspect',
                beginKeywords: 'aspect',
                end: /[{;=]/,
                excludeEnd: true,
                illegal: /[:;"\[\]]/,
                contains: [{
                    beginKeywords: 'extends implements pertypewithin perthis pertarget percflowbelow percflow issingleton'
                },
                    hljs.UNDERSCORE_TITLE_MODE, {
                        begin: /\([^\)]*/,
                        end: /[)]+/,
                        keywords: KEYWORDS + ' ' + SHORTKEYS,
                        excludeEnd: false
                    }
                ]
            }, {
                className: 'class',
                beginKeywords: 'class interface',
                end: /[{;=]/,
                excludeEnd: true,
                relevance: 0,
                keywords: 'class interface',
                illegal: /[:"\[\]]/,
                contains: [{
                    beginKeywords: 'extends implements'
                },
                    hljs.UNDERSCORE_TITLE_MODE
                ]
            }, {
                // AspectJ Constructs
                beginKeywords: 'pointcut after before around throwing returning',
                end: /[)]/,
                excludeEnd: false,
                illegal: /["\[\]]/,
                contains: [{
                    begin: hljs.UNDERSCORE_IDENT_RE + '\\s*\\(',
                    returnBegin: true,
                    contains: [hljs.UNDERSCORE_TITLE_MODE]
                }]
            }, {
                begin: /[:]/,
                returnBegin: true,
                end: /[{;]/,
                relevance: 0,
                excludeEnd: false,
                keywords: KEYWORDS,
                illegal: /["\[\]]/,
                contains: [{
                    begin: hljs.UNDERSCORE_IDENT_RE + '\\s*\\(',
                    keywords: KEYWORDS + ' ' + SHORTKEYS
                },
                    hljs.QUOTE_STRING_MODE
                ]
            }, {
                // this prevents 'new Name(...), or throw ...' from being recognized as a function definition
                beginKeywords: 'new throw',
                relevance: 0
            }, {
                // the function class is a bit different for AspectJ compared to the Java language
                className: 'function',
                begin: /\w+ +\w+(\.)?\w+\s*\([^\)]*\)\s*((throws)[\w\s,]+)?[\{;]/,
                returnBegin: true,
                end: /[{;=]/,
                keywords: KEYWORDS,
                excludeEnd: true,
                contains: [{
                    begin: hljs.UNDERSCORE_IDENT_RE + '\\s*\\(',
                    returnBegin: true,
                    relevance: 0,
                    contains: [hljs.UNDERSCORE_TITLE_MODE]
                }, {
                    className: 'params',
                    begin: /\(/,
                    end: /\)/,
                    relevance: 0,
                    keywords: KEYWORDS,
                    contains: [
                        hljs.APOS_STRING_MODE,
                        hljs.QUOTE_STRING_MODE,
                        hljs.C_NUMBER_MODE,
                        hljs.C_BLOCK_COMMENT_MODE
                    ]
                },
                    hljs.C_LINE_COMMENT_MODE,
                    hljs.C_BLOCK_COMMENT_MODE
                ]
            },
            hljs.C_NUMBER_MODE, {
                // annotation is also used in this language
                className: 'annotation',
                begin: '@[A-Za-z]+'
            }
        ]
    };
});
hljs.registerLanguage('autohotkey', function (hljs) {
    var BACKTICK_ESCAPE = {
        className: 'escape',
        begin: '`[\\s\\S]'
    };
    var COMMENTS = {
        className: 'comment',
        begin: ';',
        end: '$',
        relevance: 0
    };
    var BUILT_IN = [{
        className: 'built_in',
        begin: 'A_[a-zA-Z0-9]+'
    }, {
        className: 'built_in',
        beginKeywords: 'ComSpec Clipboard ClipboardAll ErrorLevel'
    }];

    return {
        case_insensitive: true,
        keywords: {
            keyword: 'Break Continue Else Gosub If Loop Return While',
            literal: 'A true false NOT AND OR'
        },
        contains: BUILT_IN.concat([
            BACKTICK_ESCAPE,
            hljs.inherit(hljs.QUOTE_STRING_MODE, {
                contains: [BACKTICK_ESCAPE]
            }),
            COMMENTS, {
                className: 'number',
                begin: hljs.NUMBER_RE,
                relevance: 0
            }, {
                className: 'var_expand', // FIXME
                begin: '%',
                end: '%',
                illegal: '\\n',
                contains: [BACKTICK_ESCAPE]
            }, {
                className: 'label',
                contains: [BACKTICK_ESCAPE],
                variants: [{
                    begin: '^[^\\n";]+::(?!=)'
                }, {
                    begin: '^[^\\n";]+:(?!=)',
                    relevance: 0
                } // zero relevance as it catches a lot of things
                    // followed by a single ':' in many languages
                ]
            }, {
                // consecutive commas, not for highlighting but just for relevance
                begin: ',\\s*,',
                relevance: 10
            }
        ])
    }
});
hljs.registerLanguage('avrasm', function (hljs) {
    return {
        case_insensitive: true,
        lexemes: '\\.?' + hljs.IDENT_RE,
        keywords: {
            keyword: /* mnemonic */
            'adc add adiw and andi asr bclr bld brbc brbs brcc brcs break breq brge brhc brhs ' +
            'brid brie brlo brlt brmi brne brpl brsh brtc brts brvc brvs bset bst call cbi cbr ' +
            'clc clh cli cln clr cls clt clv clz com cp cpc cpi cpse dec eicall eijmp elpm eor ' +
            'fmul fmuls fmulsu icall ijmp in inc jmp ld ldd ldi lds lpm lsl lsr mov movw mul ' +
            'muls mulsu neg nop or ori out pop push rcall ret reti rjmp rol ror sbc sbr sbrc sbrs ' +
            'sec seh sbi sbci sbic sbis sbiw sei sen ser ses set sev sez sleep spm st std sts sub ' +
            'subi swap tst wdr',
            built_in: /* general purpose registers */
            'r0 r1 r2 r3 r4 r5 r6 r7 r8 r9 r10 r11 r12 r13 r14 r15 r16 r17 r18 r19 r20 r21 r22 ' +
            'r23 r24 r25 r26 r27 r28 r29 r30 r31 x|0 xh xl y|0 yh yl z|0 zh zl ' +
                /* IO Registers (ATMega128) */
            'ucsr1c udr1 ucsr1a ucsr1b ubrr1l ubrr1h ucsr0c ubrr0h tccr3c tccr3a tccr3b tcnt3h ' +
            'tcnt3l ocr3ah ocr3al ocr3bh ocr3bl ocr3ch ocr3cl icr3h icr3l etimsk etifr tccr1c ' +
            'ocr1ch ocr1cl twcr twdr twar twsr twbr osccal xmcra xmcrb eicra spmcsr spmcr portg ' +
            'ddrg ping portf ddrf sreg sph spl xdiv rampz eicrb eimsk gimsk gicr eifr gifr timsk ' +
            'tifr mcucr mcucsr tccr0 tcnt0 ocr0 assr tccr1a tccr1b tcnt1h tcnt1l ocr1ah ocr1al ' +
            'ocr1bh ocr1bl icr1h icr1l tccr2 tcnt2 ocr2 ocdr wdtcr sfior eearh eearl eedr eecr ' +
            'porta ddra pina portb ddrb pinb portc ddrc pinc portd ddrd pind spdr spsr spcr udr0 ' +
            'ucsr0a ucsr0b ubrr0l acsr admux adcsr adch adcl porte ddre pine pinf',
            preprocessor: '.byte .cseg .db .def .device .dseg .dw .endmacro .equ .eseg .exit .include .list ' +
            '.listmac .macro .nolist .org .set'
        },
        contains: [
            hljs.C_BLOCK_COMMENT_MODE, {
                className: 'comment',
                begin: ';',
                end: '$',
                relevance: 0
            },
            hljs.C_NUMBER_MODE, // 0x..., decimal, float
            hljs.BINARY_NUMBER_MODE, // 0b...
            {
                className: 'number',
                begin: '\\b(\\$[a-zA-Z0-9]+|0o[0-7]+)' // $..., 0o...
            },
            hljs.QUOTE_STRING_MODE, {
                className: 'string',
                begin: '\'',
                end: '[^\\\\]\'',
                illegal: '[^\\\\][^\']'
            }, {
                className: 'label',
                begin: '^[A-Za-z0-9_.$]+:'
            }, {
                className: 'preprocessor',
                begin: '#',
                end: '$'
            }, { // подстановка в «.macro»
                className: 'localvars',
                begin: '@[0-9]+'
            }
        ]
    };
});
hljs.registerLanguage('axapta', function (hljs) {
    return {
        keywords: 'false int abstract private char boolean static null if for true ' +
        'while long throw finally protected final return void enum else ' +
        'break new catch byte super case short default double public try this switch ' +
        'continue reverse firstfast firstonly forupdate nofetch sum avg minof maxof count ' +
        'order group by asc desc index hint like dispaly edit client server ttsbegin ' +
        'ttscommit str real date container anytype common div mod',
        contains: [
            hljs.C_LINE_COMMENT_MODE,
            hljs.C_BLOCK_COMMENT_MODE,
            hljs.APOS_STRING_MODE,
            hljs.QUOTE_STRING_MODE,
            hljs.C_NUMBER_MODE, {
                className: 'preprocessor',
                begin: '#',
                end: '$'
            }, {
                className: 'class',
                beginKeywords: 'class interface',
                end: '{',
                excludeEnd: true,
                illegal: ':',
                contains: [{
                    beginKeywords: 'extends implements'
                },
                    hljs.UNDERSCORE_TITLE_MODE
                ]
            }
        ]
    };
});
hljs.registerLanguage('bash', function (hljs) {
    var VAR = {
        className: 'variable',
        variants: [{
            begin: /\$[\w\d#@][\w\d_]*/
        }, {
            begin: /\$\{(.*?)}/
        }]
    };
    var QUOTE_STRING = {
        className: 'string',
        begin: /"/,
        end: /"/,
        contains: [
            hljs.BACKSLASH_ESCAPE,
            VAR, {
                className: 'variable',
                begin: /\$\(/,
                end: /\)/,
                contains: [hljs.BACKSLASH_ESCAPE]
            }
        ]
    };
    var APOS_STRING = {
        className: 'string',
        begin: /'/,
        end: /'/
    };

    return {
        aliases: ['sh', 'zsh'],
        lexemes: /-?[a-z\.]+/,
        keywords: {
            keyword: 'if then else elif fi for while in do done case esac function',
            literal: 'true false',
            built_in: // Shell built-ins
            // http://www.gnu.org/software/bash/manual/html_node/Shell-Builtin-Commands.html
            'break cd continue eval exec exit export getopts hash pwd readonly return shift test times ' +
            'trap umask unset ' +
                // Bash built-ins
            'alias bind builtin caller command declare echo enable help let local logout mapfile printf ' +
            'read readarray source type typeset ulimit unalias ' +
                // Shell modifiers
            'set shopt ' +
                // Zsh built-ins
            'autoload bg bindkey bye cap chdir clone comparguments compcall compctl compdescribe compfiles ' +
            'compgroups compquote comptags comptry compvalues dirs disable disown echotc echoti emulate ' +
            'fc fg float functions getcap getln history integer jobs kill limit log noglob popd print ' +
            'pushd pushln rehash sched setcap setopt stat suspend ttyctl unfunction unhash unlimit ' +
            'unsetopt vared wait whence where which zcompile zformat zftp zle zmodload zparseopts zprof ' +
            'zpty zregexparse zsocket zstyle ztcp',
            operator: '-ne -eq -lt -gt -f -d -e -s -l -a' // relevance booster
        },
        contains: [{
            className: 'shebang',
            begin: /^#![^\n]+sh\s*$/,
            relevance: 10
        }, {
            className: 'function',
            begin: /\w[\w\d_]*\s*\(\s*\)\s*\{/,
            returnBegin: true,
            contains: [hljs.inherit(hljs.TITLE_MODE, {
                begin: /\w[\w\d_]*/
            })],
            relevance: 0
        },
            hljs.HASH_COMMENT_MODE,
            hljs.NUMBER_MODE,
            QUOTE_STRING,
            APOS_STRING,
            VAR
        ]
    };
});
hljs.registerLanguage('brainfuck', function (hljs) {
    var LITERAL = {
        className: 'literal',
        begin: '[\\+\\-]',
        relevance: 0
    };
    return {
        aliases: ['bf'],
        contains: [{
            className: 'comment',
            begin: '[^\\[\\]\\.,\\+\\-<> \r\n]',
            returnEnd: true,
            end: '[\\[\\]\\.,\\+\\-<> \r\n]',
            relevance: 0
        }, {
            className: 'title',
            begin: '[\\[\\]]',
            relevance: 0
        }, {
            className: 'string',
            begin: '[\\.,]',
            relevance: 0
        }, {
            // this mode works as the only relevance counter
            begin: /\+\+|\-\-/,
            returnBegin: true,
            contains: [LITERAL]
        },
            LITERAL
        ]
    };
});
hljs.registerLanguage('capnproto', function (hljs) {
    return {
        aliases: ['capnp'],
        keywords: {
            keyword: 'struct enum interface union group import using const annotation extends in of on as with from fixed',
            built_in: 'Void Bool Int8 Int16 Int32 Int64 UInt8 UInt16 UInt32 UInt64 Float32 Float64 ' +
            'Text Data AnyPointer AnyStruct Capability List',
            literal: 'true false'
        },
        contains: [
            hljs.QUOTE_STRING_MODE,
            hljs.NUMBER_MODE,
            hljs.HASH_COMMENT_MODE, {
                className: 'shebang',
                begin: /@0x[\w\d]{16};/,
                illegal: /\n/
            }, {
                className: 'number',
                begin: /@\d+\b/
            }, {
                className: 'class',
                beginKeywords: 'struct enum',
                end: /\{/,
                illegal: /\n/,
                contains: [
                    hljs.inherit(hljs.TITLE_MODE, {
                        starts: {
                            endsWithParent: true,
                            excludeEnd: true
                        } // hack: eating everything after the first title
                    })
                ]
            }, {
                className: 'class',
                beginKeywords: 'interface',
                end: /\{/,
                illegal: /\n/,
                contains: [
                    hljs.inherit(hljs.TITLE_MODE, {
                        starts: {
                            endsWithParent: true,
                            excludeEnd: true
                        } // hack: eating everything after the first title
                    })
                ]
            }
        ]
    };
});
hljs.registerLanguage('clojure', function (hljs) {
    var keywords = {
        built_in: // Clojure keywords
        'def cond apply if-not if-let if not not= = < > <= >= == + / * - rem ' +
        'quot neg? pos? delay? symbol? keyword? true? false? integer? empty? coll? list? ' +
        'set? ifn? fn? associative? sequential? sorted? counted? reversible? number? decimal? ' +
        'class? distinct? isa? float? rational? reduced? ratio? odd? even? char? seq? vector? ' +
        'string? map? nil? contains? zero? instance? not-every? not-any? libspec? -> ->> .. . ' +
        'inc compare do dotimes mapcat take remove take-while drop letfn drop-last take-last ' +
        'drop-while while intern condp case reduced cycle split-at split-with repeat replicate ' +
        'iterate range merge zipmap declare line-seq sort comparator sort-by dorun doall nthnext ' +
        'nthrest partition eval doseq await await-for let agent atom send send-off release-pending-sends ' +
        'add-watch mapv filterv remove-watch agent-error restart-agent set-error-handler error-handler ' +
        'set-error-mode! error-mode shutdown-agents quote var fn loop recur throw try monitor-enter ' +
        'monitor-exit defmacro defn defn- macroexpand macroexpand-1 for dosync and or ' +
        'when when-not when-let comp juxt partial sequence memoize constantly complement identity assert ' +
        'peek pop doto proxy defstruct first rest cons defprotocol cast coll deftype defrecord last butlast ' +
        'sigs reify second ffirst fnext nfirst nnext defmulti defmethod meta with-meta ns in-ns create-ns import ' +
        'refer keys select-keys vals key val rseq name namespace promise into transient persistent! conj! ' +
        'assoc! dissoc! pop! disj! use class type num float double short byte boolean bigint biginteger ' +
        'bigdec print-method print-dup throw-if printf format load compile get-in update-in pr pr-on newline ' +
        'flush read slurp read-line subvec with-open memfn time re-find re-groups rand-int rand mod locking ' +
        'assert-valid-fdecl alias resolve ref deref refset swap! reset! set-validator! compare-and-set! alter-meta! ' +
        'reset-meta! commute get-validator alter ref-set ref-history-count ref-min-history ref-max-history ensure sync io! ' +
        'new next conj set! to-array future future-call into-array aset gen-class reduce map filter find empty ' +
        'hash-map hash-set sorted-map sorted-map-by sorted-set sorted-set-by vec vector seq flatten reverse assoc dissoc list ' +
        'disj get union difference intersection extend extend-type extend-protocol int nth delay count concat chunk chunk-buffer ' +
        'chunk-append chunk-first chunk-rest max min dec unchecked-inc-int unchecked-inc unchecked-dec-inc unchecked-dec unchecked-negate ' +
        'unchecked-add-int unchecked-add unchecked-subtract-int unchecked-subtract chunk-next chunk-cons chunked-seq? prn vary-meta ' +
        'lazy-seq spread list* str find-keyword keyword symbol gensym force rationalize'
    };

    var SYMBOLSTART = 'a-zA-Z_\\-!.?+*=<>&#\'';
    var SYMBOL_RE = '[' + SYMBOLSTART + '][' + SYMBOLSTART + '0-9/;:]*';
    var SIMPLE_NUMBER_RE = '[-+]?\\d+(\\.\\d+)?';

    var SYMBOL = {
        begin: SYMBOL_RE,
        relevance: 0
    };
    var NUMBER = {
        className: 'number',
        begin: SIMPLE_NUMBER_RE,
        relevance: 0
    };
    var STRING = hljs.inherit(hljs.QUOTE_STRING_MODE, {
        illegal: null
    });
    var COMMENT = {
        className: 'comment',
        begin: ';',
        end: '$',
        relevance: 0
    };
    var LITERAL = {
        className: 'literal',
        begin: /\b(true|false|nil)\b/
    }
    var COLLECTION = {
        className: 'collection',
        begin: '[\\[\\{]',
        end: '[\\]\\}]'
    };
    var HINT = {
        className: 'comment',
        begin: '\\^' + SYMBOL_RE
    };
    var HINT_COL = {
        className: 'comment',
        begin: '\\^\\{',
        end: '\\}'

    };
    var KEY = {
        className: 'attribute',
        begin: '[:]' + SYMBOL_RE
    };
    var LIST = {
        className: 'list',
        begin: '\\(',
        end: '\\)'
    };
    var BODY = {
        endsWithParent: true,
        relevance: 0
    };
    var NAME = {
        keywords: keywords,
        lexemes: SYMBOL_RE,
        className: 'keyword',
        begin: SYMBOL_RE,
        starts: BODY
    };
    var DEFAULT_CONTAINS = [LIST, STRING, HINT, HINT_COL, COMMENT, KEY, COLLECTION, NUMBER, LITERAL, SYMBOL];

    LIST.contains = [{
        className: 'comment',
        begin: 'comment'
    }, NAME, BODY];
    BODY.contains = DEFAULT_CONTAINS;
    COLLECTION.contains = DEFAULT_CONTAINS;

    return {
        aliases: ['clj'],
        illegal: /\S/,
        contains: [LIST, STRING, HINT, HINT_COL, COMMENT, KEY, COLLECTION, NUMBER, LITERAL]
    }
});
hljs.registerLanguage('clojure-repl', function (hljs) {
    return {
        contains: [{
            className: 'prompt',
            begin: /^([\w.-]+|\s*#_)=>/,
            starts: {
                end: /$/,
                subLanguage: 'clojure',
                subLanguageMode: 'continuous'
            }
        }]
    }
});
hljs.registerLanguage('cmake', function (hljs) {
    return {
        aliases: ['cmake.in'],
        case_insensitive: true,
        keywords: {
            keyword: 'add_custom_command add_custom_target add_definitions add_dependencies ' +
            'add_executable add_library add_subdirectory add_test aux_source_directory ' +
            'break build_command cmake_minimum_required cmake_policy configure_file ' +
            'create_test_sourcelist define_property else elseif enable_language enable_testing ' +
            'endforeach endfunction endif endmacro endwhile execute_process export find_file ' +
            'find_library find_package find_path find_program fltk_wrap_ui foreach function ' +
            'get_cmake_property get_directory_property get_filename_component get_property ' +
            'get_source_file_property get_target_property get_test_property if include ' +
            'include_directories include_external_msproject include_regular_expression install ' +
            'link_directories load_cache load_command macro mark_as_advanced message option ' +
            'output_required_files project qt_wrap_cpp qt_wrap_ui remove_definitions return ' +
            'separate_arguments set set_directory_properties set_property ' +
            'set_source_files_properties set_target_properties set_tests_properties site_name ' +
            'source_group string target_link_libraries try_compile try_run unset variable_watch ' +
            'while build_name exec_program export_library_dependencies install_files ' +
            'install_programs install_targets link_libraries make_directory remove subdir_depends ' +
            'subdirs use_mangled_mesa utility_source variable_requires write_file ' +
            'qt5_use_modules qt5_use_package qt5_wrap_cpp on off true false and or',
            operator: 'equal less greater strless strgreater strequal matches'
        },
        contains: [{
            className: 'envvar',
            begin: '\\${',
            end: '}'
        },
            hljs.HASH_COMMENT_MODE,
            hljs.QUOTE_STRING_MODE,
            hljs.NUMBER_MODE
        ]
    };
});
hljs.registerLanguage('coffeescript', function (hljs) {
    var KEYWORDS = {
        keyword: // JS keywords
        'in if for while finally new do return else break catch instanceof throw try this ' +
        'switch continue typeof delete debugger super ' +
            // Coffee keywords
        'then unless until loop of by when and or is isnt not',
        literal: // JS literals
        'true false null undefined ' +
            // Coffee literals
        'yes no on off',
        reserved: 'case default function var void with const let enum export import native ' +
        '__hasProp __extends __slice __bind __indexOf',
        built_in: 'npm require console print module global window document'
    };
    var JS_IDENT_RE = '[A-Za-z$_][0-9A-Za-z$_]*';
    var SUBST = {
        className: 'subst',
        begin: /#\{/,
        end: /}/,
        keywords: KEYWORDS
    };
    var EXPRESSIONS = [
        hljs.BINARY_NUMBER_MODE,
        hljs.inherit(hljs.C_NUMBER_MODE, {
            starts: {
                end: '(\\s*/)?',
                relevance: 0
            }
        }), // a number tries to eat the following slash to prevent treating it as a regexp
        {
            className: 'string',
            variants: [{
                begin: /'''/,
                end: /'''/,
                contains: [hljs.BACKSLASH_ESCAPE]
            }, {
                begin: /'/,
                end: /'/,
                contains: [hljs.BACKSLASH_ESCAPE]
            }, {
                begin: /"""/,
                end: /"""/,
                contains: [hljs.BACKSLASH_ESCAPE, SUBST]
            }, {
                begin: /"/,
                end: /"/,
                contains: [hljs.BACKSLASH_ESCAPE, SUBST]
            }]
        }, {
            className: 'regexp',
            variants: [{
                begin: '///',
                end: '///',
                contains: [SUBST, hljs.HASH_COMMENT_MODE]
            }, {
                begin: '//[gim]*',
                relevance: 0
            }, {
                // regex can't start with space to parse x / 2 / 3 as two divisions
                // regex can't start with *, and it supports an "illegal" in the main mode
                begin: /\/(?![ *])(\\\/|.)*?\/[gim]*(?=\W|$)/
            }]
        }, {
            className: 'property',
            begin: '@' + JS_IDENT_RE
        }, {
            begin: '`',
            end: '`',
            excludeBegin: true,
            excludeEnd: true,
            subLanguage: 'javascript'
        }
    ];
    SUBST.contains = EXPRESSIONS;

    var TITLE = hljs.inherit(hljs.TITLE_MODE, {
        begin: JS_IDENT_RE
    });
    var PARAMS_RE = '(\\(.*\\))?\\s*\\B[-=]>';
    var PARAMS = {
        className: 'params',
        begin: '\\([^\\(]',
        returnBegin: true,
        /* We need another contained nameless mode to not have every nested
         pair of parens to be called "params" */
        contains: [{
            begin: /\(/,
            end: /\)/,
            keywords: KEYWORDS,
            contains: ['self'].concat(EXPRESSIONS)
        }]
    };

    return {
        aliases: ['coffee', 'cson', 'iced'],
        keywords: KEYWORDS,
        illegal: /\/\*/,
        contains: EXPRESSIONS.concat([{
            className: 'comment',
            begin: '###',
            end: '###',
            contains: [hljs.PHRASAL_WORDS_MODE]
        },
            hljs.HASH_COMMENT_MODE, {
                className: 'function',
                begin: '^\\s*' + JS_IDENT_RE + '\\s*=\\s*' + PARAMS_RE,
                end: '[-=]>',
                returnBegin: true,
                contains: [TITLE, PARAMS]
            }, {
                // anonymous function start
                begin: /[:\(,=]\s*/,
                relevance: 0,
                contains: [{
                    className: 'function',
                    begin: PARAMS_RE,
                    end: '[-=]>',
                    returnBegin: true,
                    contains: [PARAMS]
                }]
            }, {
                className: 'class',
                beginKeywords: 'class',
                end: '$',
                illegal: /[:="\[\]]/,
                contains: [{
                    beginKeywords: 'extends',
                    endsWithParent: true,
                    illegal: /[:="\[\]]/,
                    contains: [TITLE]
                },
                    TITLE
                ]
            }, {
                className: 'attribute',
                begin: JS_IDENT_RE + ':',
                end: ':',
                returnBegin: true,
                returnEnd: true,
                relevance: 0
            }
        ])
    };
});
hljs.registerLanguage('cpp', function (hljs) {
    var CPP_KEYWORDS = {
        keyword: 'false int float while private char catch export virtual operator sizeof ' +
        'dynamic_cast|10 typedef const_cast|10 const struct for static_cast|10 union namespace ' +
        'unsigned long volatile static protected bool template mutable if public friend ' +
        'do goto auto void enum else break extern using true class asm case typeid ' +
        'short reinterpret_cast|10 default double register explicit signed typename try this ' +
        'switch continue wchar_t inline delete alignof char16_t char32_t constexpr decltype ' +
        'noexcept nullptr static_assert thread_local restrict _Bool complex _Complex _Imaginary ' +
        'intmax_t uintmax_t int8_t uint8_t int16_t uint16_t int32_t uint32_t  int64_t uint64_t ' +
        'int_least8_t uint_least8_t int_least16_t uint_least16_t int_least32_t uint_least32_t ' +
        'int_least64_t uint_least64_t int_fast8_t uint_fast8_t int_fast16_t uint_fast16_t int_fast32_t ' +
        'uint_fast32_t int_fast64_t uint_fast64_t intptr_t uintptr_t atomic_bool atomic_char atomic_schar ' +
        'atomic_uchar atomic_short atomic_ushort atomic_int atomic_uint atomic_long atomic_ulong atomic_llong ' +
        'atomic_ullong atomic_wchar_t atomic_char16_t atomic_char32_t atomic_intmax_t atomic_uintmax_t ' +
        'atomic_intptr_t atomic_uintptr_t atomic_size_t atomic_ptrdiff_t atomic_int_least8_t atomic_int_least16_t ' +
        'atomic_int_least32_t atomic_int_least64_t atomic_uint_least8_t atomic_uint_least16_t atomic_uint_least32_t ' +
        'atomic_uint_least64_t atomic_int_fast8_t atomic_int_fast16_t atomic_int_fast32_t atomic_int_fast64_t ' +
        'atomic_uint_fast8_t atomic_uint_fast16_t atomic_uint_fast32_t atomic_uint_fast64_t',
        built_in: 'std string cin cout cerr clog stringstream istringstream ostringstream ' +
        'auto_ptr deque list queue stack vector map set bitset multiset multimap unordered_set ' +
        'unordered_map unordered_multiset unordered_multimap array shared_ptr abort abs acos ' +
        'asin atan2 atan calloc ceil cosh cos exit exp fabs floor fmod fprintf fputs free frexp ' +
        'fscanf isalnum isalpha iscntrl isdigit isgraph islower isprint ispunct isspace isupper ' +
        'isxdigit tolower toupper labs ldexp log10 log malloc memchr memcmp memcpy memset modf pow ' +
        'printf putchar puts scanf sinh sin snprintf sprintf sqrt sscanf strcat strchr strcmp ' +
        'strcpy strcspn strlen strncat strncmp strncpy strpbrk strrchr strspn strstr tanh tan ' +
        'vfprintf vprintf vsprintf'
    };
    return {
        aliases: ['c', 'cc', 'h', 'c++', 'h++', 'hpp'],
        keywords: CPP_KEYWORDS,
        illegal: '</',
        contains: [
            hljs.C_LINE_COMMENT_MODE,
            hljs.C_BLOCK_COMMENT_MODE,
            hljs.QUOTE_STRING_MODE, {
                className: 'string',
                begin: '\'\\\\?.',
                end: '\'',
                illegal: '.'
            }, {
                className: 'number',
                begin: '\\b(\\d+(\\.\\d*)?|\\.\\d+)(u|U|l|L|ul|UL|f|F)'
            },
            hljs.C_NUMBER_MODE, {
                className: 'preprocessor',
                begin: '#',
                end: '$',
                keywords: 'if else elif endif define undef warning error line pragma',
                contains: [{
                    begin: /\\\n/,
                    relevance: 0
                }, {
                    begin: 'include\\s*[<"]',
                    end: '[>"]',
                    keywords: 'include',
                    illegal: '\\n'
                },
                    hljs.C_LINE_COMMENT_MODE
                ]
            }, {
                begin: '\\b(deque|list|queue|stack|vector|map|set|bitset|multiset|multimap|unordered_map|unordered_set|unordered_multiset|unordered_multimap|array)\\s*<',
                end: '>',
                keywords: CPP_KEYWORDS,
                contains: ['self']
            }, {
                begin: hljs.IDENT_RE + '::',
                keywords: CPP_KEYWORDS
            }, {
                // Expression keywords prevent 'keyword Name(...) or else if(...)' from
                // being recognized as a function definition
                beginKeywords: 'new throw return else',
                relevance: 0
            }, {
                className: 'function',
                begin: '(' + hljs.IDENT_RE + '\\s+)+' + hljs.IDENT_RE + '\\s*\\(',
                returnBegin: true,
                end: /[{;=]/,
                excludeEnd: true,
                keywords: CPP_KEYWORDS,
                contains: [{
                    begin: hljs.IDENT_RE + '\\s*\\(',
                    returnBegin: true,
                    contains: [hljs.TITLE_MODE],
                    relevance: 0
                }, {
                    className: 'params',
                    begin: /\(/,
                    end: /\)/,
                    keywords: CPP_KEYWORDS,
                    relevance: 0,
                    contains: [
                        hljs.C_BLOCK_COMMENT_MODE
                    ]
                },
                    hljs.C_LINE_COMMENT_MODE,
                    hljs.C_BLOCK_COMMENT_MODE
                ]
            }
        ]
    };
});
hljs.registerLanguage('cs', function (hljs) {
    var KEYWORDS =
        // Normal keywords.
        'abstract as base bool break byte case catch char checked const continue decimal dynamic ' +
        'default delegate do double else enum event explicit extern false finally fixed float ' +
        'for foreach goto if implicit in int interface internal is lock long null when ' +
        'object operator out override params private protected public readonly ref sbyte ' +
        'sealed short sizeof stackalloc static string struct switch this true try typeof ' +
        'uint ulong unchecked unsafe ushort using virtual volatile void while async ' +
        'protected public private internal ' +
            // Contextual keywords.
        'ascending descending from get group into join let orderby partial select set value var ' +
        'where yield';
    var GENERIC_IDENT_RE = hljs.IDENT_RE + '(<' + hljs.IDENT_RE + '>)?';
    return {
        aliases: ['csharp'],
        keywords: KEYWORDS,
        illegal: /::/,
        contains: [{
            className: 'comment',
            begin: '///',
            end: '$',
            returnBegin: true,
            contains: [{
                className: 'xmlDocTag',
                variants: [{
                    begin: '///',
                    relevance: 0
                }, {
                    begin: '<!--|-->'
                }, {
                    begin: '</?',
                    end: '>'
                }]
            }]
        },
            hljs.C_LINE_COMMENT_MODE,
            hljs.C_BLOCK_COMMENT_MODE, {
                className: 'preprocessor',
                begin: '#',
                end: '$',
                keywords: 'if else elif endif define undef warning error line region endregion pragma checksum'
            }, {
                className: 'string',
                begin: '@"',
                end: '"',
                contains: [{
                    begin: '""'
                }]
            },
            hljs.APOS_STRING_MODE,
            hljs.QUOTE_STRING_MODE,
            hljs.C_NUMBER_MODE, {
                beginKeywords: 'class namespace interface',
                end: /[{;=]/,
                illegal: /[^\s:]/,
                contains: [
                    hljs.TITLE_MODE,
                    hljs.C_LINE_COMMENT_MODE,
                    hljs.C_BLOCK_COMMENT_MODE
                ]
            }, {
                // Expression keywords prevent 'keyword Name(...)' from being
                // recognized as a function definition
                beginKeywords: 'new return throw await',
                relevance: 0
            }, {
                className: 'function',
                begin: '(' + GENERIC_IDENT_RE + '\\s+)+' + hljs.IDENT_RE + '\\s*\\(',
                returnBegin: true,
                end: /[{;=]/,
                excludeEnd: true,
                keywords: KEYWORDS,
                contains: [{
                    begin: hljs.IDENT_RE + '\\s*\\(',
                    returnBegin: true,
                    contains: [hljs.TITLE_MODE],
                    relevance: 0
                }, {
                    className: 'params',
                    begin: /\(/,
                    end: /\)/,
                    keywords: KEYWORDS,
                    relevance: 0,
                    contains: [
                        hljs.APOS_STRING_MODE,
                        hljs.QUOTE_STRING_MODE,
                        hljs.C_NUMBER_MODE,
                        hljs.C_BLOCK_COMMENT_MODE
                    ]
                },
                    hljs.C_LINE_COMMENT_MODE,
                    hljs.C_BLOCK_COMMENT_MODE
                ]
            }
        ]
    };
});
hljs.registerLanguage('css', function (hljs) {
    var IDENT_RE = '[a-zA-Z-][a-zA-Z0-9_-]*';
    var FUNCTION = {
        className: 'function',
        begin: IDENT_RE + '\\(',
        returnBegin: true,
        excludeEnd: true,
        end: '\\('
    };
    return {
        case_insensitive: true,
        illegal: '[=/|\']',
        contains: [
            hljs.C_BLOCK_COMMENT_MODE, {
                className: 'id',
                begin: '\\#[A-Za-z0-9_-]+'
            }, {
                className: 'class',
                begin: '\\.[A-Za-z0-9_-]+',
                relevance: 0
            }, {
                className: 'attr_selector',
                begin: '\\[',
                end: '\\]',
                illegal: '$'
            }, {
                className: 'pseudo',
                begin: ':(:)?[a-zA-Z0-9\\_\\-\\+\\(\\)\\"\\\']+'
            }, {
                className: 'at_rule',
                begin: '@(font-face|page)',
                lexemes: '[a-z-]+',
                keywords: 'font-face page'
            }, {
                className: 'at_rule',
                begin: '@',
                end: '[{;]', // at_rule eating first "{" is a good thing
                // because it doesn’t let it to be parsed as
                // a rule set but instead drops parser into
                // the default mode which is how it should be.
                contains: [{
                    className: 'keyword',
                    begin: /\S+/
                }, {
                    begin: /\s/,
                    endsWithParent: true,
                    excludeEnd: true,
                    relevance: 0,
                    contains: [
                        FUNCTION,
                        hljs.APOS_STRING_MODE, hljs.QUOTE_STRING_MODE,
                        hljs.CSS_NUMBER_MODE
                    ]
                }]
            }, {
                className: 'tag',
                begin: IDENT_RE,
                relevance: 0
            }, {
                className: 'rules',
                begin: '{',
                end: '}',
                illegal: '[^\\s]',
                relevance: 0,
                contains: [
                    hljs.C_BLOCK_COMMENT_MODE, {
                        className: 'rule',
                        begin: '[^\\s]',
                        returnBegin: true,
                        end: ';',
                        endsWithParent: true,
                        contains: [{
                            className: 'attribute',
                            begin: '[A-Z\\_\\.\\-]+',
                            end: ':',
                            excludeEnd: true,
                            illegal: '[^\\s]',
                            starts: {
                                className: 'value',
                                endsWithParent: true,
                                excludeEnd: true,
                                contains: [
                                    FUNCTION,
                                    hljs.CSS_NUMBER_MODE,
                                    hljs.QUOTE_STRING_MODE,
                                    hljs.APOS_STRING_MODE,
                                    hljs.C_BLOCK_COMMENT_MODE, {
                                        className: 'hexcolor',
                                        begin: '#[0-9A-Fa-f]+'
                                    }, {
                                        className: 'important',
                                        begin: '!important'
                                    }
                                ]
                            }
                        }]
                    }
                ]
            }
        ]
    };
});
hljs.registerLanguage('d',
    /**
     * Known issues:
     *
     * - invalid hex string literals will be recognized as a double quoted strings
     *   but 'x' at the beginning of string will not be matched
     *
     * - delimited string literals are not checked for matching end delimiter
     *   (not possible to do with js regexp)
     *
     * - content of token string is colored as a string (i.e. no keyword coloring inside a token string)
     *   also, content of token string is not validated to contain only valid D tokens
     *
     * - special token sequence rule is not strictly following D grammar (anything following #line
     *   up to the end of line is matched as special token sequence)
     */

    function (hljs) {
        /**
         * Language keywords
         *
         * @type {Object}
         */
        var D_KEYWORDS = {
            keyword: 'abstract alias align asm assert auto body break byte case cast catch class ' +
            'const continue debug default delete deprecated do else enum export extern final ' +
            'finally for foreach foreach_reverse|10 goto if immutable import in inout int ' +
            'interface invariant is lazy macro mixin module new nothrow out override package ' +
            'pragma private protected public pure ref return scope shared static struct ' +
            'super switch synchronized template this throw try typedef typeid typeof union ' +
            'unittest version void volatile while with __FILE__ __LINE__ __gshared|10 ' +
            '__thread __traits __DATE__ __EOF__ __TIME__ __TIMESTAMP__ __VENDOR__ __VERSION__',
            built_in: 'bool cdouble cent cfloat char creal dchar delegate double dstring float function ' +
            'idouble ifloat ireal long real short string ubyte ucent uint ulong ushort wchar ' +
            'wstring',
            literal: 'false null true'
        };

        /**
         * Number literal regexps
         *
         * @type {String}
         */
        var decimal_integer_re = '(0|[1-9][\\d_]*)',
            decimal_integer_nosus_re = '(0|[1-9][\\d_]*|\\d[\\d_]*|[\\d_]+?\\d)',
            binary_integer_re = '0[bB][01_]+',
            hexadecimal_digits_re = '([\\da-fA-F][\\da-fA-F_]*|_[\\da-fA-F][\\da-fA-F_]*)',
            hexadecimal_integer_re = '0[xX]' + hexadecimal_digits_re,

            decimal_exponent_re = '([eE][+-]?' + decimal_integer_nosus_re + ')',
            decimal_float_re = '(' + decimal_integer_nosus_re + '(\\.\\d*|' + decimal_exponent_re + ')|' +
                '\\d+\\.' + decimal_integer_nosus_re + decimal_integer_nosus_re + '|' +
                '\\.' + decimal_integer_re + decimal_exponent_re + '?' +
                ')',
            hexadecimal_float_re = '(0[xX](' +
                hexadecimal_digits_re + '\\.' + hexadecimal_digits_re + '|' +
                '\\.?' + hexadecimal_digits_re +
                ')[pP][+-]?' + decimal_integer_nosus_re + ')',

            integer_re = '(' +
                decimal_integer_re + '|' +
                binary_integer_re + '|' +
                hexadecimal_integer_re +
                ')',

            float_re = '(' +
                hexadecimal_float_re + '|' +
                decimal_float_re +
                ')';

        /**
         * Escape sequence supported in D string and character literals
         *
         * @type {String}
         */
        var escape_sequence_re = '\\\\(' +
            '[\'"\\?\\\\abfnrtv]|' + // common escapes
            'u[\\dA-Fa-f]{4}|' + // four hex digit unicode codepoint
            '[0-7]{1,3}|' + // one to three octal digit ascii char code
            'x[\\dA-Fa-f]{2}|' + // two hex digit ascii char code
            'U[\\dA-Fa-f]{8}' + // eight hex digit unicode codepoint
            ')|' +
            '&[a-zA-Z\\d]{2,};'; // named character entity

        /**
         * D integer number literals
         *
         * @type {Object}
         */
        var D_INTEGER_MODE = {
            className: 'number',
            begin: '\\b' + integer_re + '(L|u|U|Lu|LU|uL|UL)?',
            relevance: 0
        };

        /**
         * [D_FLOAT_MODE description]
         * @type {Object}
         */
        var D_FLOAT_MODE = {
            className: 'number',
            begin: '\\b(' +
            float_re + '([fF]|L|i|[fF]i|Li)?|' +
            integer_re + '(i|[fF]i|Li)' +
            ')',
            relevance: 0
        };

        /**
         * D character literal
         *
         * @type {Object}
         */
        var D_CHARACTER_MODE = {
            className: 'string',
            begin: '\'(' + escape_sequence_re + '|.)',
            end: '\'',
            illegal: '.'
        };

        /**
         * D string escape sequence
         *
         * @type {Object}
         */
        var D_ESCAPE_SEQUENCE = {
            begin: escape_sequence_re,
            relevance: 0
        };

        /**
         * D double quoted string literal
         *
         * @type {Object}
         */
        var D_STRING_MODE = {
            className: 'string',
            begin: '"',
            contains: [D_ESCAPE_SEQUENCE],
            end: '"[cwd]?'
        };

        /**
         * D wysiwyg and delimited string literals
         *
         * @type {Object}
         */
        var D_WYSIWYG_DELIMITED_STRING_MODE = {
            className: 'string',
            begin: '[rq]"',
            end: '"[cwd]?',
            relevance: 5
        };

        /**
         * D alternate wysiwyg string literal
         *
         * @type {Object}
         */
        var D_ALTERNATE_WYSIWYG_STRING_MODE = {
            className: 'string',
            begin: '`',
            end: '`[cwd]?'
        };

        /**
         * D hexadecimal string literal
         *
         * @type {Object}
         */
        var D_HEX_STRING_MODE = {
            className: 'string',
            begin: 'x"[\\da-fA-F\\s\\n\\r]*"[cwd]?',
            relevance: 10
        };

        /**
         * D delimited string literal
         *
         * @type {Object}
         */
        var D_TOKEN_STRING_MODE = {
            className: 'string',
            begin: 'q"\\{',
            end: '\\}"'
        };

        /**
         * Hashbang support
         *
         * @type {Object}
         */
        var D_HASHBANG_MODE = {
            className: 'shebang',
            begin: '^#!',
            end: '$',
            relevance: 5
        };

        /**
         * D special token sequence
         *
         * @type {Object}
         */
        var D_SPECIAL_TOKEN_SEQUENCE_MODE = {
            className: 'preprocessor',
            begin: '#(line)',
            end: '$',
            relevance: 5
        };

        /**
         * D attributes
         *
         * @type {Object}
         */
        var D_ATTRIBUTE_MODE = {
            className: 'keyword',
            begin: '@[a-zA-Z_][a-zA-Z_\\d]*'
        };

        /**
         * D nesting comment
         *
         * @type {Object}
         */
        var D_NESTING_COMMENT_MODE = {
            className: 'comment',
            begin: '\\/\\+',
            contains: ['self'],
            end: '\\+\\/',
            relevance: 10
        };

        return {
            lexemes: hljs.UNDERSCORE_IDENT_RE,
            keywords: D_KEYWORDS,
            contains: [
                hljs.C_LINE_COMMENT_MODE,
                hljs.C_BLOCK_COMMENT_MODE,
                D_NESTING_COMMENT_MODE,
                D_HEX_STRING_MODE,
                D_STRING_MODE,
                D_WYSIWYG_DELIMITED_STRING_MODE,
                D_ALTERNATE_WYSIWYG_STRING_MODE,
                D_TOKEN_STRING_MODE,
                D_FLOAT_MODE,
                D_INTEGER_MODE,
                D_CHARACTER_MODE,
                D_HASHBANG_MODE,
                D_SPECIAL_TOKEN_SEQUENCE_MODE,
                D_ATTRIBUTE_MODE
            ]
        };
    });
hljs.registerLanguage('markdown', function (hljs) {
    return {
        aliases: ['md', 'mkdown', 'mkd'],
        contains: [
            // highlight headers
            {
                className: 'header',
                variants: [{
                    begin: '^#{1,6}',
                    end: '$'
                }, {
                    begin: '^.+?\\n[=-]{2,}$'
                }]
            },
            // inline html
            {
                begin: '<',
                end: '>',
                subLanguage: 'xml',
                relevance: 0
            },
            // lists (indicators only)
            {
                className: 'bullet',
                begin: '^([*+-]|(\\d+\\.))\\s+'
            },
            // strong segments
            {
                className: 'strong',
                begin: '[*_]{2}.+?[*_]{2}'
            },
            // emphasis segments
            {
                className: 'emphasis',
                variants: [{
                    begin: '\\*.+?\\*'
                }, {
                    begin: '_.+?_',
                    relevance: 0
                }]
            },
            // blockquotes
            {
                className: 'blockquote',
                begin: '^>\\s+',
                end: '$'
            },
            // code snippets
            {
                className: 'code',
                variants: [{
                    begin: '`.+?`'
                }, {
                    begin: '^( {4}|\t)',
                    end: '$',
                    relevance: 0
                }]
            },
            // horizontal rules
            {
                className: 'horizontal_rule',
                begin: '^[-\\*]{3,}',
                end: '$'
            },
            // using links - title and link
            {
                begin: '\\[.+?\\][\\(\\[].*?[\\)\\]]',
                returnBegin: true,
                contains: [{
                    className: 'link_label',
                    begin: '\\[',
                    end: '\\]',
                    excludeBegin: true,
                    returnEnd: true,
                    relevance: 0
                }, {
                    className: 'link_url',
                    begin: '\\]\\(',
                    end: '\\)',
                    excludeBegin: true,
                    excludeEnd: true
                }, {
                    className: 'link_reference',
                    begin: '\\]\\[',
                    end: '\\]',
                    excludeBegin: true,
                    excludeEnd: true
                }],
                relevance: 10
            }, {
                begin: '^\\[\.+\\]:',
                returnBegin: true,
                contains: [{
                    className: 'link_reference',
                    begin: '\\[',
                    end: '\\]:',
                    excludeBegin: true,
                    excludeEnd: true,
                    starts: {
                        className: 'link_url',
                        end: '$'
                    }
                }]
            }
        ]
    };
});
hljs.registerLanguage('dart', function (hljs) {
    var SUBST = {
        className: 'subst',
        begin: '\\$\\{',
        end: '}',
        keywords: 'true false null this is new super'
    };

    var STRING = {
        className: 'string',
        variants: [{
            begin: 'r\'\'\'',
            end: '\'\'\''
        }, {
            begin: 'r"""',
            end: '"""'
        }, {
            begin: 'r\'',
            end: '\'',
            illegal: '\\n'
        }, {
            begin: 'r"',
            end: '"',
            illegal: '\\n'
        }, {
            begin: '\'\'\'',
            end: '\'\'\'',
            contains: [hljs.BACKSLASH_ESCAPE, SUBST]
        }, {
            begin: '"""',
            end: '"""',
            contains: [hljs.BACKSLASH_ESCAPE, SUBST]
        }, {
            begin: '\'',
            end: '\'',
            illegal: '\\n',
            contains: [hljs.BACKSLASH_ESCAPE, SUBST]
        }, {
            begin: '"',
            end: '"',
            illegal: '\\n',
            contains: [hljs.BACKSLASH_ESCAPE, SUBST]
        }]
    };
    SUBST.contains = [
        hljs.C_NUMBER_MODE, STRING
    ];

    var KEYWORDS = {
        keyword: 'assert break case catch class const continue default do else enum extends false final finally for if ' +
        'in is new null rethrow return super switch this throw true try var void while with',
        literal: 'abstract as dynamic export external factory get implements import library operator part set static typedef',
        built_in: // dart:core
        'print Comparable DateTime Duration Function Iterable Iterator List Map Match Null Object Pattern RegExp Set ' +
        'Stopwatch String StringBuffer StringSink Symbol Type Uri bool double int num ' +
            // dart:html
        'document window querySelector querySelectorAll Element ElementList'
    };

    return {
        keywords: KEYWORDS,
        contains: [
            STRING, {
                className: 'dartdoc',
                begin: '/\\*\\*',
                end: '\\*/',
                subLanguage: 'markdown',
                subLanguageMode: 'continuous'
            }, {
                className: 'dartdoc',
                begin: '///',
                end: '$',
                subLanguage: 'markdown',
                subLanguageMode: 'continuous'
            },
            hljs.C_LINE_COMMENT_MODE,
            hljs.C_BLOCK_COMMENT_MODE, {
                className: 'class',
                beginKeywords: 'class interface',
                end: '{',
                excludeEnd: true,
                contains: [{
                    beginKeywords: 'extends implements'
                },
                    hljs.UNDERSCORE_TITLE_MODE
                ]
            },
            hljs.C_NUMBER_MODE, {
                className: 'annotation',
                begin: '@[A-Za-z]+'
            }, {
                begin: '=>' // No markup, just a relevance booster
            }
        ]
    }
});
hljs.registerLanguage('delphi', function (hljs) {
    var KEYWORDS =
        'exports register file shl array record property for mod while set ally label uses raise not ' +
        'stored class safecall var interface or private static exit index inherited to else stdcall ' +
        'override shr asm far resourcestring finalization packed virtual out and protected library do ' +
        'xorwrite goto near function end div overload object unit begin string on inline repeat until ' +
        'destructor write message program with read initialization except default nil if case cdecl in ' +
        'downto threadvar of try pascal const external constructor type public then implementation ' +
        'finally published procedure';
    var COMMENT = {
        className: 'comment',
        variants: [{
            begin: /\{/,
            end: /}/,
            relevance: 0
        }, {
            begin: /\(\*/,
            end: /\*\)/,
            relevance: 10
        }]
    };
    var STRING = {
        className: 'string',
        begin: /'/,
        end: /'/,
        contains: [{
            begin: /''/
        }]
    };
    var CHAR_STRING = {
        className: 'string',
        begin: /(#\d+)+/
    };
    var CLASS = {
        begin: hljs.IDENT_RE + '\\s*=\\s*class\\s*\\(',
        returnBegin: true,
        contains: [
            hljs.TITLE_MODE
        ]
    };
    var FUNCTION = {
        className: 'function',
        beginKeywords: 'function constructor destructor procedure',
        end: /[:;]/,
        keywords: 'function constructor|10 destructor|10 procedure|10',
        contains: [
            hljs.TITLE_MODE, {
                className: 'params',
                begin: /\(/,
                end: /\)/,
                keywords: KEYWORDS,
                contains: [STRING, CHAR_STRING]
            },
            COMMENT
        ]
    };
    return {
        case_insensitive: true,
        keywords: KEYWORDS,
        illegal: /"|\$[G-Zg-z]|\/\*|<\/|\|/,
        contains: [
            COMMENT, hljs.C_LINE_COMMENT_MODE,
            STRING, CHAR_STRING,
            hljs.NUMBER_MODE,
            CLASS,
            FUNCTION
        ]
    };
});
hljs.registerLanguage('diff', function (hljs) {
    return {
        aliases: ['patch'],
        contains: [{
            className: 'chunk',
            relevance: 10,
            variants: [{
                begin: /^@@ +\-\d+,\d+ +\+\d+,\d+ +@@$/
            }, {
                begin: /^\*\*\* +\d+,\d+ +\*\*\*\*$/
            }, {
                begin: /^\-\-\- +\d+,\d+ +\-\-\-\-$/
            }]
        }, {
            className: 'header',
            variants: [{
                begin: /Index: /,
                end: /$/
            }, {
                begin: /=====/,
                end: /=====$/
            }, {
                begin: /^\-\-\-/,
                end: /$/
            }, {
                begin: /^\*{3} /,
                end: /$/
            }, {
                begin: /^\+\+\+/,
                end: /$/
            }, {
                begin: /\*{5}/,
                end: /\*{5}$/
            }]
        }, {
            className: 'addition',
            begin: '^\\+',
            end: '$'
        }, {
            className: 'deletion',
            begin: '^\\-',
            end: '$'
        }, {
            className: 'change',
            begin: '^\\!',
            end: '$'
        }]
    };
});
hljs.registerLanguage('django', function (hljs) {
    var FILTER = {
        className: 'filter',
        begin: /\|[A-Za-z]+:?/,
        keywords: 'truncatewords removetags linebreaksbr yesno get_digit timesince random striptags ' +
        'filesizeformat escape linebreaks length_is ljust rjust cut urlize fix_ampersands ' +
        'title floatformat capfirst pprint divisibleby add make_list unordered_list urlencode ' +
        'timeuntil urlizetrunc wordcount stringformat linenumbers slice date dictsort ' +
        'dictsortreversed default_if_none pluralize lower join center default ' +
        'truncatewords_html upper length phone2numeric wordwrap time addslashes slugify first ' +
        'escapejs force_escape iriencode last safe safeseq truncatechars localize unlocalize ' +
        'localtime utc timezone',
        contains: [{
            className: 'argument',
            begin: /"/,
            end: /"/
        }, {
            className: 'argument',
            begin: /'/,
            end: /'/
        }]
    };

    return {
        aliases: ['jinja'],
        case_insensitive: true,
        subLanguage: 'xml',
        subLanguageMode: 'continuous',
        contains: [{
            className: 'comment',
            begin: /\{%\s*comment\s*%}/,
            end: /\{%\s*endcomment\s*%}/
        }, {
            className: 'comment',
            begin: /\{#/,
            end: /#}/
        }, {
            className: 'template_tag',
            begin: /\{%/,
            end: /%}/,
            keywords: 'comment endcomment load templatetag ifchanged endifchanged if endif firstof for ' +
            'endfor in ifnotequal endifnotequal widthratio extends include spaceless ' +
            'endspaceless regroup by as ifequal endifequal ssi now with cycle url filter ' +
            'endfilter debug block endblock else autoescape endautoescape csrf_token empty elif ' +
            'endwith static trans blocktrans endblocktrans get_static_prefix get_media_prefix ' +
            'plural get_current_language language get_available_languages ' +
            'get_current_language_bidi get_language_info get_language_info_list localize ' +
            'endlocalize localtime endlocaltime timezone endtimezone get_current_timezone ' +
            'verbatim',
            contains: [FILTER]
        }, {
            className: 'variable',
            begin: /\{\{/,
            end: /}}/,
            contains: [FILTER]
        }]
    };
});
hljs.registerLanguage('dockerfile', function (hljs) {
    return {
        aliases: ['docker'],
        case_insensitive: true,
        keywords: {
            built_ins: 'from maintainer cmd expose add copy entrypoint volume user workdir onbuild run env'
        },
        contains: [
            hljs.HASH_COMMENT_MODE, {
                keywords: {
                    built_in: 'run cmd entrypoint volume add copy workdir onbuild'
                },
                begin: /^ *(onbuild +)?(run|cmd|entrypoint|volume|add|copy|workdir) +/,
                starts: {
                    end: /[^\\]\n/,
                    subLanguage: 'bash',
                    subLanguageMode: 'continuous'
                }
            }, {
                keywords: {
                    built_in: 'from maintainer expose env user onbuild'
                },
                begin: /^ *(onbuild +)?(from|maintainer|expose|env|user|onbuild) +/,
                end: /[^\\]\n/,
                contains: [
                    hljs.APOS_STRING_MODE,
                    hljs.QUOTE_STRING_MODE,
                    hljs.NUMBER_MODE,
                    hljs.HASH_COMMENT_MODE
                ]
            }
        ]
    }
});
hljs.registerLanguage('dos', function (hljs) {
    var COMMENT = {
        className: 'comment',
        begin: /@?rem\b/,
        end: /$/,
        relevance: 10
    };
    var LABEL = {
        className: 'label',
        begin: '^\\s*[A-Za-z._?][A-Za-z0-9_$#@~.?]*(:|\\s+label)',
        relevance: 0
    };
    return {
        aliases: ['bat', 'cmd'],
        case_insensitive: true,
        keywords: {
            flow: 'if else goto for in do call exit not exist errorlevel defined',
            operator: 'equ neq lss leq gtr geq',
            keyword: 'shift cd dir echo setlocal endlocal set pause copy',
            stream: 'prn nul lpt3 lpt2 lpt1 con com4 com3 com2 com1 aux',
            winutils: 'ping net ipconfig taskkill xcopy ren del',
            built_in: 'append assoc at attrib break cacls cd chcp chdir chkdsk chkntfs cls cmd color ' +
            'comp compact convert date dir diskcomp diskcopy doskey erase fs ' +
            'find findstr format ftype graftabl help keyb label md mkdir mode more move path ' +
            'pause print popd pushd promt rd recover rem rename replace restore rmdir shift' +
            'sort start subst time title tree type ver verify vol'
        },
        contains: [{
            className: 'envvar',
            begin: /%%[^ ]|%[^ ]+?%|![^ ]+?!/
        }, {
            className: 'function',
            begin: LABEL.begin,
            end: 'goto:eof',
            contains: [
                hljs.inherit(hljs.TITLE_MODE, {
                    begin: '([_a-zA-Z]\\w*\\.)*([_a-zA-Z]\\w*:)?[_a-zA-Z]\\w*'
                }),
                COMMENT
            ]
        }, {
            className: 'number',
            begin: '\\b\\d+',
            relevance: 0
        },
            COMMENT
        ]
    };
});
hljs.registerLanguage('dust', function (hljs) {
    var EXPRESSION_KEYWORDS = 'if eq ne lt lte gt gte select default math sep';
    return {
        aliases: ['dst'],
        case_insensitive: true,
        subLanguage: 'xml',
        subLanguageMode: 'continuous',
        contains: [{
            className: 'expression',
            begin: '{',
            end: '}',
            relevance: 0,
            contains: [{
                className: 'begin-block',
                begin: '\#[a-zA-Z\-\ \.]+',
                keywords: EXPRESSION_KEYWORDS
            }, {
                className: 'string',
                begin: '"',
                end: '"'
            }, {
                className: 'end-block',
                begin: '\\\/[a-zA-Z\-\ \.]+',
                keywords: EXPRESSION_KEYWORDS
            }, {
                className: 'variable',
                begin: '[a-zA-Z\-\.]+',
                keywords: EXPRESSION_KEYWORDS,
                relevance: 0
            }]
        }]
    };
});
hljs.registerLanguage('elixir', function (hljs) {
    var ELIXIR_IDENT_RE = '[a-zA-Z_][a-zA-Z0-9_]*(\\!|\\?)?';
    var ELIXIR_METHOD_RE = '[a-zA-Z_]\\w*[!?=]?|[-+~]\\@|<<|>>|=~|===?|<=>|[<>]=?|\\*\\*|[-/+%^&*~`|]|\\[\\]=?';
    var ELIXIR_KEYWORDS =
        'and false then defined module in return redo retry end for true self when ' +
        'next until do begin unless nil break not case cond alias while ensure or ' +
        'include use alias fn quote';
    var SUBST = {
        className: 'subst',
        begin: '#\\{',
        end: '}',
        lexemes: ELIXIR_IDENT_RE,
        keywords: ELIXIR_KEYWORDS
    };
    var STRING = {
        className: 'string',
        contains: [hljs.BACKSLASH_ESCAPE, SUBST],
        variants: [{
            begin: /'/,
            end: /'/
        }, {
            begin: /"/,
            end: /"/
        }]
    };
    var PARAMS = {
        endsWithParent: true,
        returnEnd: true,
        lexemes: ELIXIR_IDENT_RE,
        keywords: ELIXIR_KEYWORDS,
        relevance: 0
    };
    var FUNCTION = {
        className: 'function',
        beginKeywords: 'def defmacro',
        end: /\bdo\b/,
        contains: [
            hljs.inherit(hljs.TITLE_MODE, {
                begin: ELIXIR_METHOD_RE,
                starts: PARAMS
            })
        ]
    };
    var CLASS = hljs.inherit(FUNCTION, {
        className: 'class',
        beginKeywords: 'defmodule defrecord',
        end: /\bdo\b|$|;/
    });
    var ELIXIR_DEFAULT_CONTAINS = [
        STRING,
        hljs.HASH_COMMENT_MODE,
        CLASS,
        FUNCTION, {
            className: 'constant',
            begin: '(\\b[A-Z_]\\w*(.)?)+',
            relevance: 0
        }, {
            className: 'symbol',
            begin: ':',
            contains: [STRING, {
                begin: ELIXIR_METHOD_RE
            }],
            relevance: 0
        }, {
            className: 'symbol',
            begin: ELIXIR_IDENT_RE + ':',
            relevance: 0
        }, {
            className: 'number',
            begin: '(\\b0[0-7_]+)|(\\b0x[0-9a-fA-F_]+)|(\\b[1-9][0-9_]*(\\.[0-9_]+)?)|[0_]\\b',
            relevance: 0
        }, {
            className: 'variable',
            begin: '(\\$\\W)|((\\$|\\@\\@?)(\\w+))'
        }, {
            begin: '->'
        }, { // regexp container
            begin: '(' + hljs.RE_STARTERS_RE + ')\\s*',
            contains: [
                hljs.HASH_COMMENT_MODE, {
                    className: 'regexp',
                    illegal: '\\n',
                    contains: [hljs.BACKSLASH_ESCAPE, SUBST],
                    variants: [{
                        begin: '/',
                        end: '/[a-z]*'
                    }, {
                        begin: '%r\\[',
                        end: '\\][a-z]*'
                    }]
                }
            ],
            relevance: 0
        }
    ];
    SUBST.contains = ELIXIR_DEFAULT_CONTAINS;
    PARAMS.contains = ELIXIR_DEFAULT_CONTAINS;

    return {
        lexemes: ELIXIR_IDENT_RE,
        keywords: ELIXIR_KEYWORDS,
        contains: ELIXIR_DEFAULT_CONTAINS
    };
});
hljs.registerLanguage('ruby', function (hljs) {
    var RUBY_METHOD_RE = '[a-zA-Z_]\\w*[!?=]?|[-+~]\\@|<<|>>|=~|===?|<=>|[<>]=?|\\*\\*|[-/+%^&*~`|]|\\[\\]=?';
    var RUBY_KEYWORDS =
        'and false then defined module in return redo if BEGIN retry end for true self when ' +
        'next until do begin unless END rescue nil else break undef not super class case ' +
        'require yield alias while ensure elsif or include attr_reader attr_writer attr_accessor';
    var YARDOCTAG = {
        className: 'yardoctag',
        begin: '@[A-Za-z]+'
    };
    var IRB_OBJECT = {
        className: 'value',
        begin: '#<',
        end: '>'
    };
    var COMMENT = {
        className: 'comment',
        variants: [{
            begin: '#',
            end: '$',
            contains: [YARDOCTAG]
        }, {
            begin: '^\\=begin',
            end: '^\\=end',
            contains: [YARDOCTAG],
            relevance: 10
        }, {
            begin: '^__END__',
            end: '\\n$'
        }]
    };
    var SUBST = {
        className: 'subst',
        begin: '#\\{',
        end: '}',
        keywords: RUBY_KEYWORDS
    };
    var STRING = {
        className: 'string',
        contains: [hljs.BACKSLASH_ESCAPE, SUBST],
        variants: [{
            begin: /'/,
            end: /'/
        }, {
            begin: /"/,
            end: /"/
        }, {
            begin: /`/,
            end: /`/
        }, {
            begin: '%[qQwWx]?\\(',
            end: '\\)'
        }, {
            begin: '%[qQwWx]?\\[',
            end: '\\]'
        }, {
            begin: '%[qQwWx]?{',
            end: '}'
        }, {
            begin: '%[qQwWx]?<',
            end: '>'
        }, {
            begin: '%[qQwWx]?/',
            end: '/'
        }, {
            begin: '%[qQwWx]?%',
            end: '%'
        }, {
            begin: '%[qQwWx]?-',
            end: '-'
        }, {
            begin: '%[qQwWx]?\\|',
            end: '\\|'
        }, {
            // \B in the beginning suppresses recognition of ?-sequences where ?
            // is the last character of a preceding identifier, as in: `func?4`
            begin: /\B\?(\\\d{1,3}|\\x[A-Fa-f0-9]{1,2}|\\u[A-Fa-f0-9]{4}|\\?\S)\b/
        }]
    };
    var PARAMS = {
        className: 'params',
        begin: '\\(',
        end: '\\)',
        keywords: RUBY_KEYWORDS
    };

    var RUBY_DEFAULT_CONTAINS = [
        STRING,
        IRB_OBJECT,
        COMMENT, {
            className: 'class',
            beginKeywords: 'class module',
            end: '$|;',
            illegal: /=/,
            contains: [
                hljs.inherit(hljs.TITLE_MODE, {
                    begin: '[A-Za-z_]\\w*(::\\w+)*(\\?|\\!)?'
                }), {
                    className: 'inheritance',
                    begin: '<\\s*',
                    contains: [{
                        className: 'parent',
                        begin: '(' + hljs.IDENT_RE + '::)?' + hljs.IDENT_RE
                    }]
                },
                COMMENT
            ]
        }, {
            className: 'function',
            beginKeywords: 'def',
            end: ' |$|;',
            relevance: 0,
            contains: [
                hljs.inherit(hljs.TITLE_MODE, {
                    begin: RUBY_METHOD_RE
                }),
                PARAMS,
                COMMENT
            ]
        }, {
            className: 'constant',
            begin: '(::)?(\\b[A-Z]\\w*(::)?)+',
            relevance: 0
        }, {
            className: 'symbol',
            begin: hljs.UNDERSCORE_IDENT_RE + '(\\!|\\?)?:',
            relevance: 0
        }, {
            className: 'symbol',
            begin: ':',
            contains: [STRING, {
                begin: RUBY_METHOD_RE
            }],
            relevance: 0
        }, {
            className: 'number',
            begin: '(\\b0[0-7_]+)|(\\b0x[0-9a-fA-F_]+)|(\\b[1-9][0-9_]*(\\.[0-9_]+)?)|[0_]\\b',
            relevance: 0
        }, {
            className: 'variable',
            begin: '(\\$\\W)|((\\$|\\@\\@?)(\\w+))'
        }, { // regexp container
            begin: '(' + hljs.RE_STARTERS_RE + ')\\s*',
            contains: [
                IRB_OBJECT,
                COMMENT, {
                    className: 'regexp',
                    contains: [hljs.BACKSLASH_ESCAPE, SUBST],
                    illegal: /\n/,
                    variants: [{
                        begin: '/',
                        end: '/[a-z]*'
                    }, {
                        begin: '%r{',
                        end: '}[a-z]*'
                    }, {
                        begin: '%r\\(',
                        end: '\\)[a-z]*'
                    }, {
                        begin: '%r!',
                        end: '![a-z]*'
                    }, {
                        begin: '%r\\[',
                        end: '\\][a-z]*'
                    }]
                }
            ],
            relevance: 0
        }
    ];
    SUBST.contains = RUBY_DEFAULT_CONTAINS;
    PARAMS.contains = RUBY_DEFAULT_CONTAINS;

    var SIMPLE_PROMPT = "[>?]>";
    var DEFAULT_PROMPT = "[\\w#]+\\(\\w+\\):\\d+:\\d+>";
    var RVM_PROMPT = "(\\w+-)?\\d+\\.\\d+\\.\\d(p\\d+)?[^>]+>";

    var IRB_DEFAULT = [{
        begin: /^\s*=>/,
        className: 'status',
        starts: {
            end: '$',
            contains: RUBY_DEFAULT_CONTAINS
        }
    }, {
        className: 'prompt',
        begin: '^(' + SIMPLE_PROMPT + "|" + DEFAULT_PROMPT + '|' + RVM_PROMPT + ')',
        starts: {
            end: '$',
            contains: RUBY_DEFAULT_CONTAINS
        }
    }];

    return {
        aliases: ['rb', 'gemspec', 'podspec', 'thor', 'irb'],
        keywords: RUBY_KEYWORDS,
        contains: [COMMENT].concat(IRB_DEFAULT).concat(RUBY_DEFAULT_CONTAINS)
    };
});
hljs.registerLanguage('erb', function (hljs) {
    return {
        subLanguage: 'xml',
        subLanguageMode: 'continuous',
        contains: [{
            className: 'comment',
            begin: '<%#',
            end: '%>'
        }, {
            begin: '<%[%=-]?',
            end: '[%-]?%>',
            subLanguage: 'ruby',
            excludeBegin: true,
            excludeEnd: true
        }]
    };
});
hljs.registerLanguage('erlang-repl', function (hljs) {
    return {
        keywords: {
            special_functions: 'spawn spawn_link self',
            reserved: 'after and andalso|10 band begin bnot bor bsl bsr bxor case catch cond div end fun if ' +
            'let not of or orelse|10 query receive rem try when xor'
        },
        contains: [{
            className: 'prompt',
            begin: '^[0-9]+> ',
            relevance: 10
        }, {
            className: 'comment',
            begin: '%',
            end: '$'
        }, {
            className: 'number',
            begin: '\\b(\\d+#[a-fA-F0-9]+|\\d+(\\.\\d+)?([eE][-+]?\\d+)?)',
            relevance: 0
        },
            hljs.APOS_STRING_MODE,
            hljs.QUOTE_STRING_MODE, {
                className: 'constant',
                begin: '\\?(::)?([A-Z]\\w*(::)?)+'
            }, {
                className: 'arrow',
                begin: '->'
            }, {
                className: 'ok',
                begin: 'ok'
            }, {
                className: 'exclamation_mark',
                begin: '!'
            }, {
                className: 'function_or_atom',
                begin: '(\\b[a-z\'][a-zA-Z0-9_\']*:[a-z\'][a-zA-Z0-9_\']*)|(\\b[a-z\'][a-zA-Z0-9_\']*)',
                relevance: 0
            }, {
                className: 'variable',
                begin: '[A-Z][a-zA-Z0-9_\']*',
                relevance: 0
            }
        ]
    };
});
hljs.registerLanguage('erlang', function (hljs) {
    var BASIC_ATOM_RE = '[a-z\'][a-zA-Z0-9_\']*';
    var FUNCTION_NAME_RE = '(' + BASIC_ATOM_RE + ':' + BASIC_ATOM_RE + '|' + BASIC_ATOM_RE + ')';
    var ERLANG_RESERVED = {
        keyword: 'after and andalso|10 band begin bnot bor bsl bzr bxor case catch cond div end fun if ' +
        'let not of orelse|10 query receive rem try when xor',
        literal: 'false true'
    };

    var COMMENT = {
        className: 'comment',
        begin: '%',
        end: '$'
    };
    var NUMBER = {
        className: 'number',
        begin: '\\b(\\d+#[a-fA-F0-9]+|\\d+(\\.\\d+)?([eE][-+]?\\d+)?)',
        relevance: 0
    };
    var NAMED_FUN = {
        begin: 'fun\\s+' + BASIC_ATOM_RE + '/\\d+'
    };
    var FUNCTION_CALL = {
        begin: FUNCTION_NAME_RE + '\\(',
        end: '\\)',
        returnBegin: true,
        relevance: 0,
        contains: [{
            className: 'function_name',
            begin: FUNCTION_NAME_RE,
            relevance: 0
        }, {
            begin: '\\(',
            end: '\\)',
            endsWithParent: true,
            returnEnd: true,
            relevance: 0
            // "contains" defined later
        }]
    };
    var TUPLE = {
        className: 'tuple',
        begin: '{',
        end: '}',
        relevance: 0
        // "contains" defined later
    };
    var VAR1 = {
        className: 'variable',
        begin: '\\b_([A-Z][A-Za-z0-9_]*)?',
        relevance: 0
    };
    var VAR2 = {
        className: 'variable',
        begin: '[A-Z][a-zA-Z0-9_]*',
        relevance: 0
    };
    var RECORD_ACCESS = {
        begin: '#' + hljs.UNDERSCORE_IDENT_RE,
        relevance: 0,
        returnBegin: true,
        contains: [{
            className: 'record_name',
            begin: '#' + hljs.UNDERSCORE_IDENT_RE,
            relevance: 0
        }, {
            begin: '{',
            end: '}',
            relevance: 0
            // "contains" defined later
        }]
    };

    var BLOCK_STATEMENTS = {
        beginKeywords: 'fun receive if try case',
        end: 'end',
        keywords: ERLANG_RESERVED
    };
    BLOCK_STATEMENTS.contains = [
        COMMENT,
        NAMED_FUN,
        hljs.inherit(hljs.APOS_STRING_MODE, {
            className: ''
        }),
        BLOCK_STATEMENTS,
        FUNCTION_CALL,
        hljs.QUOTE_STRING_MODE,
        NUMBER,
        TUPLE,
        VAR1, VAR2,
        RECORD_ACCESS
    ];

    var BASIC_MODES = [
        COMMENT,
        NAMED_FUN,
        BLOCK_STATEMENTS,
        FUNCTION_CALL,
        hljs.QUOTE_STRING_MODE,
        NUMBER,
        TUPLE,
        VAR1, VAR2,
        RECORD_ACCESS
    ];
    FUNCTION_CALL.contains[1].contains = BASIC_MODES;
    TUPLE.contains = BASIC_MODES;
    RECORD_ACCESS.contains[1].contains = BASIC_MODES;

    var PARAMS = {
        className: 'params',
        begin: '\\(',
        end: '\\)',
        contains: BASIC_MODES
    };
    return {
        aliases: ['erl'],
        keywords: ERLANG_RESERVED,
        illegal: '(</|\\*=|\\+=|-=|/\\*|\\*/|\\(\\*|\\*\\))',
        contains: [{
            className: 'function',
            begin: '^' + BASIC_ATOM_RE + '\\s*\\(',
            end: '->',
            returnBegin: true,
            illegal: '\\(|#|//|/\\*|\\\\|:|;',
            contains: [
                PARAMS,
                hljs.inherit(hljs.TITLE_MODE, {
                    begin: BASIC_ATOM_RE
                })
            ],
            starts: {
                end: ';|\\.',
                keywords: ERLANG_RESERVED,
                contains: BASIC_MODES
            }
        },
            COMMENT, {
                className: 'pp',
                begin: '^-',
                end: '\\.',
                relevance: 0,
                excludeEnd: true,
                returnBegin: true,
                lexemes: '-' + hljs.IDENT_RE,
                keywords: '-module -record -undef -export -ifdef -ifndef -author -copyright -doc -vsn ' +
                '-import -include -include_lib -compile -define -else -endif -file -behaviour ' +
                '-behavior -spec',
                contains: [PARAMS]
            },
            NUMBER,
            hljs.QUOTE_STRING_MODE,
            RECORD_ACCESS,
            VAR1, VAR2,
            TUPLE, {
                begin: /\.$/
            } // relevance booster
        ]
    };
});
hljs.registerLanguage('fix', function (hljs) {
    return {
        contains: [{
            begin: /[^\u2401\u0001]+/,
            end: /[\u2401\u0001]/,
            excludeEnd: true,
            returnBegin: true,
            returnEnd: false,
            contains: [{
                begin: /([^\u2401\u0001=]+)/,
                end: /=([^\u2401\u0001=]+)/,
                returnEnd: true,
                returnBegin: false,
                className: 'attribute'
            }, {
                begin: /=/,
                end: /([\u2401\u0001])/,
                excludeEnd: true,
                excludeBegin: true,
                className: 'string'
            }]
        }],
        case_insensitive: true
    };
});
hljs.registerLanguage('fortran', function (hljs) {
    var PARAMS = {
        className: 'params',
        begin: '\\(',
        end: '\\)'
    };

    var F_KEYWORDS = {
        constant: '.False. .True.',
        type: 'integer real character complex logical dimension allocatable|10 parameter ' +
        'external implicit|10 none double precision assign intent optional pointer ' +
        'target in out common equivalence data',
        keyword: 'kind do while private call intrinsic where elsewhere ' +
        'type endtype endmodule endselect endinterface end enddo endif if forall endforall only contains default return stop then ' +
        'public subroutine|10 function program .and. .or. .not. .le. .eq. .ge. .gt. .lt. ' +
        'goto save else use module select case ' +
        'access blank direct exist file fmt form formatted iostat name named nextrec number opened rec recl sequential status unformatted unit ' +
        'continue format pause cycle exit ' +
        'c_null_char c_alert c_backspace c_form_feed flush wait decimal round iomsg ' +
        'synchronous nopass non_overridable pass protected volatile abstract extends import ' +
        'non_intrinsic value deferred generic final enumerator class associate bind enum ' +
        'c_int c_short c_long c_long_long c_signed_char c_size_t c_int8_t c_int16_t c_int32_t c_int64_t c_int_least8_t c_int_least16_t ' +
        'c_int_least32_t c_int_least64_t c_int_fast8_t c_int_fast16_t c_int_fast32_t c_int_fast64_t c_intmax_t C_intptr_t c_float c_double ' +
        'c_long_double c_float_complex c_double_complex c_long_double_complex c_bool c_char c_null_ptr c_null_funptr ' +
        'c_new_line c_carriage_return c_horizontal_tab c_vertical_tab iso_c_binding c_loc c_funloc c_associated  c_f_pointer ' +
        'c_ptr c_funptr iso_fortran_env character_storage_size error_unit file_storage_size input_unit iostat_end iostat_eor ' +
        'numeric_storage_size output_unit c_f_procpointer ieee_arithmetic ieee_support_underflow_control ' +
        'ieee_get_underflow_mode ieee_set_underflow_mode newunit contiguous ' +
        'pad position action delim readwrite eor advance nml interface procedure namelist include sequence elemental pure',
        built_in: 'alog alog10 amax0 amax1 amin0 amin1 amod cabs ccos cexp clog csin csqrt dabs dacos dasin datan datan2 dcos dcosh ddim dexp dint ' +
        'dlog dlog10 dmax1 dmin1 dmod dnint dsign dsin dsinh dsqrt dtan dtanh float iabs idim idint idnint ifix isign max0 max1 min0 min1 sngl ' +
        'algama cdabs cdcos cdexp cdlog cdsin cdsqrt cqabs cqcos cqexp cqlog cqsin cqsqrt dcmplx dconjg derf derfc dfloat dgamma dimag dlgama ' +
        'iqint qabs qacos qasin qatan qatan2 qcmplx qconjg qcos qcosh qdim qerf qerfc qexp qgamma qimag qlgama qlog qlog10 qmax1 qmin1 qmod ' +
        'qnint qsign qsin qsinh qsqrt qtan qtanh abs acos aimag aint anint asin atan atan2 char cmplx conjg cos cosh exp ichar index int log ' +
        'log10 max min nint sign sin sinh sqrt tan tanh print write dim lge lgt lle llt mod nullify allocate deallocate ' +
        'adjustl adjustr all allocated any associated bit_size btest ceiling count cshift date_and_time digits dot_product ' +
        'eoshift epsilon exponent floor fraction huge iand ibclr ibits ibset ieor ior ishft ishftc lbound len_trim matmul ' +
        'maxexponent maxloc maxval merge minexponent minloc minval modulo mvbits nearest pack present product ' +
        'radix random_number random_seed range repeat reshape rrspacing scale scan selected_int_kind selected_real_kind ' +
        'set_exponent shape size spacing spread sum system_clock tiny transpose trim ubound unpack verify achar iachar transfer ' +
        'dble entry dprod cpu_time command_argument_count get_command get_command_argument get_environment_variable is_iostat_end ' +
        'ieee_arithmetic ieee_support_underflow_control ieee_get_underflow_mode ieee_set_underflow_mode ' +
        'is_iostat_eor move_alloc new_line selected_char_kind same_type_as extends_type_of' +
        'acosh asinh atanh bessel_j0 bessel_j1 bessel_jn bessel_y0 bessel_y1 bessel_yn erf erfc erfc_scaled gamma log_gamma hypot norm2 ' +
        'atomic_define atomic_ref execute_command_line leadz trailz storage_size merge_bits ' +
        'bge bgt ble blt dshiftl dshiftr findloc iall iany iparity image_index lcobound ucobound maskl maskr ' +
        'num_images parity popcnt poppar shifta shiftl shiftr this_image'
    };
    return {
        case_insensitive: true,
        aliases: ['f90', 'f95'],
        keywords: F_KEYWORDS,
        contains: [
            hljs.inherit(hljs.APOS_STRING_MODE, {
                className: 'string',
                relevance: 0
            }),
            hljs.inherit(hljs.QUOTE_STRING_MODE, {
                className: 'string',
                relevance: 0
            }), {
                className: 'function',
                beginKeywords: 'subroutine function program',
                illegal: '[${=\\n]',
                contains: [hljs.UNDERSCORE_TITLE_MODE, PARAMS]
            }, {
                className: 'comment',
                begin: '!',
                end: '$',
                contains: [hljs.PHRASAL_WORDS_MODE]
            }, {
                className: 'number',
                begin: '-?(\\d+(\\.\\d*)?|\\.\\d+)([DdEe][+-]?\\d+)?',
                relevance: 0
            },
        ]
    };
});
hljs.registerLanguage('fsharp', function (hljs) {
    var TYPEPARAM = {
        begin: '<',
        end: '>',
        contains: [
            hljs.inherit(hljs.TITLE_MODE, {
                begin: /'[a-zA-Z0-9_]+/
            })
        ]
    };

    return {
        aliases: ['fs'],
        keywords: // monad builder keywords (at top, matches before non-bang kws)
        'yield! return! let! do!' +
            // regular keywords
        'abstract and as assert base begin class default delegate do done ' +
        'downcast downto elif else end exception extern false finally for ' +
        'fun function global if in inherit inline interface internal lazy let ' +
        'match member module mutable namespace new null of open or ' +
        'override private public rec return sig static struct then to ' +
        'true try type upcast use val void when while with yield',
        contains: [{
            className: 'string',
            begin: '@"',
            end: '"',
            contains: [{
                begin: '""'
            }]
        }, {
            className: 'string',
            begin: '"""',
            end: '"""'
        }, {
            className: 'comment',
            begin: '\\(\\*',
            end: '\\*\\)'
        }, {
            className: 'class',
            beginKeywords: 'type',
            end: '\\(|=|$',
            excludeEnd: true,
            contains: [
                hljs.UNDERSCORE_TITLE_MODE,
                TYPEPARAM
            ]
        }, {
            className: 'annotation',
            begin: '\\[<',
            end: '>\\]',
            relevance: 10
        }, {
            className: 'attribute',
            begin: '\\B(\'[A-Za-z])\\b',
            contains: [hljs.BACKSLASH_ESCAPE]
        },
            hljs.C_LINE_COMMENT_MODE,
            hljs.inherit(hljs.QUOTE_STRING_MODE, {
                illegal: null
            }),
            hljs.C_NUMBER_MODE
        ]
    };
});
hljs.registerLanguage('gcode', function (hljs) {
    var GCODE_IDENT_RE = '[A-Z_][A-Z0-9_.]*';
    var GCODE_CLOSE_RE = '\\%';
    var GCODE_KEYWORDS = {
        literal: '',
        built_in: '',
        keyword: 'IF DO WHILE ENDWHILE CALL ENDIF SUB ENDSUB GOTO REPEAT ENDREPEAT ' +
        'EQ LT GT NE GE LE OR XOR'
    };
    var GCODE_START = {
        className: 'preprocessor',
        begin: '([O])([0-9]+)'
    };
    var GCODE_CODE = [
        hljs.C_LINE_COMMENT_MODE, {
            className: 'comment',
            begin: /\(/,
            end: /\)/,
            contains: [hljs.PHRASAL_WORDS_MODE]
        },
        hljs.C_BLOCK_COMMENT_MODE,
        hljs.inherit(hljs.C_NUMBER_MODE, {
            begin: '([-+]?([0-9]*\\.?[0-9]+\\.?))|' + hljs.C_NUMBER_RE
        }),
        hljs.inherit(hljs.APOS_STRING_MODE, {
            illegal: null
        }),
        hljs.inherit(hljs.QUOTE_STRING_MODE, {
            illegal: null
        }), {
            className: 'keyword',
            begin: '([G])([0-9]+\\.?[0-9]?)'
        }, {
            className: 'title',
            begin: '([M])([0-9]+\\.?[0-9]?)'
        }, {
            className: 'title',
            begin: '(VC|VS|#)',
            end: '(\\d+)'
        }, {
            className: 'title',
            begin: '(VZOFX|VZOFY|VZOFZ)'
        }, {
            className: 'built_in',
            begin: '(ATAN|ABS|ACOS|ASIN|SIN|COS|EXP|FIX|FUP|ROUND|LN|TAN)(\\[)',
            end: '([-+]?([0-9]*\\.?[0-9]+\\.?))(\\])'
        }, {
            className: 'label',
            variants: [{
                begin: 'N',
                end: '\\d+',
                illegal: '\\W'
            }]
        }
    ];

    return {
        aliases: ['nc'],
        // Some implementations (CNC controls) of G-code are interoperable with uppercase and lowercase letters seamlessly.
        // However, most prefer all uppercase and uppercase is customary.
        case_insensitive: true,
        lexemes: GCODE_IDENT_RE,
        keywords: GCODE_KEYWORDS,
        contains: [{
            className: 'preprocessor',
            begin: GCODE_CLOSE_RE
        },
            GCODE_START
        ].concat(GCODE_CODE)
    };
});
hljs.registerLanguage('gherkin', function (hljs) {
    return {
        aliases: ['feature'],
        keywords: 'Feature Background Ability Business\ Need Scenario Scenarios Scenario\ Outline Scenario\ Template Examples Given And Then But When',
        contains: [{
            className: 'keyword',
            begin: '\\*'
        }, {
            className: 'comment',
            begin: '@[^@\r\n\t ]+',
            end: '$'
        }, {
            className: 'string',
            begin: '\\|',
            end: '\\$'
        }, {
            className: 'variable',
            begin: '<',
            end: '>'
        },
            hljs.HASH_COMMENT_MODE, {
                className: 'string',
                begin: '"""',
                end: '"""'
            },
            hljs.QUOTE_STRING_MODE
        ]
    };
});
hljs.registerLanguage('glsl', function (hljs) {
    return {
        keywords: {
            keyword: 'atomic_uint attribute bool break bvec2 bvec3 bvec4 case centroid coherent const continue default ' +
            'discard dmat2 dmat2x2 dmat2x3 dmat2x4 dmat3 dmat3x2 dmat3x3 dmat3x4 dmat4 dmat4x2 dmat4x3 ' +
            'dmat4x4 do double dvec2 dvec3 dvec4 else flat float for highp if iimage1D iimage1DArray ' +
            'iimage2D iimage2DArray iimage2DMS iimage2DMSArray iimage2DRect iimage3D iimageBuffer iimageCube ' +
            'iimageCubeArray image1D image1DArray image2D image2DArray image2DMS image2DMSArray image2DRect ' +
            'image3D imageBuffer imageCube imageCubeArray in inout int invariant isampler1D isampler1DArray ' +
            'isampler2D isampler2DArray isampler2DMS isampler2DMSArray isampler2DRect isampler3D isamplerBuffer ' +
            'isamplerCube isamplerCubeArray ivec2 ivec3 ivec4 layout lowp mat2 mat2x2 mat2x3 mat2x4 mat3 mat3x2 ' +
            'mat3x3 mat3x4 mat4 mat4x2 mat4x3 mat4x4 mediump noperspective out patch precision readonly restrict ' +
            'return sample sampler1D sampler1DArray sampler1DArrayShadow sampler1DShadow sampler2D sampler2DArray ' +
            'sampler2DArrayShadow sampler2DMS sampler2DMSArray sampler2DRect sampler2DRectShadow sampler2DShadow ' +
            'sampler3D samplerBuffer samplerCube samplerCubeArray samplerCubeArrayShadow samplerCubeShadow smooth ' +
            'struct subroutine switch uimage1D uimage1DArray uimage2D uimage2DArray uimage2DMS uimage2DMSArray ' +
            'uimage2DRect uimage3D uimageBuffer uimageCube uimageCubeArray uint uniform usampler1D usampler1DArray ' +
            'usampler2D usampler2DArray usampler2DMS usampler2DMSArray usampler2DRect usampler3D usamplerBuffer ' +
            'usamplerCube usamplerCubeArray uvec2 uvec3 uvec4 varying vec2 vec3 vec4 void volatile while writeonly',
            built_in: 'gl_BackColor gl_BackLightModelProduct gl_BackLightProduct gl_BackMaterial ' +
            'gl_BackSecondaryColor gl_ClipDistance gl_ClipPlane gl_ClipVertex gl_Color ' +
            'gl_DepthRange gl_EyePlaneQ gl_EyePlaneR gl_EyePlaneS gl_EyePlaneT gl_Fog gl_FogCoord ' +
            'gl_FogFragCoord gl_FragColor gl_FragCoord gl_FragData gl_FragDepth gl_FrontColor ' +
            'gl_FrontFacing gl_FrontLightModelProduct gl_FrontLightProduct gl_FrontMaterial ' +
            'gl_FrontSecondaryColor gl_InstanceID gl_InvocationID gl_Layer gl_LightModel ' +
            'gl_LightSource gl_MaxAtomicCounterBindings gl_MaxAtomicCounterBufferSize ' +
            'gl_MaxClipDistances gl_MaxClipPlanes gl_MaxCombinedAtomicCounterBuffers ' +
            'gl_MaxCombinedAtomicCounters gl_MaxCombinedImageUniforms gl_MaxCombinedImageUnitsAndFragmentOutputs ' +
            'gl_MaxCombinedTextureImageUnits gl_MaxDrawBuffers gl_MaxFragmentAtomicCounterBuffers ' +
            'gl_MaxFragmentAtomicCounters gl_MaxFragmentImageUniforms gl_MaxFragmentInputComponents ' +
            'gl_MaxFragmentUniformComponents gl_MaxFragmentUniformVectors gl_MaxGeometryAtomicCounterBuffers ' +
            'gl_MaxGeometryAtomicCounters gl_MaxGeometryImageUniforms gl_MaxGeometryInputComponents ' +
            'gl_MaxGeometryOutputComponents gl_MaxGeometryOutputVertices gl_MaxGeometryTextureImageUnits ' +
            'gl_MaxGeometryTotalOutputComponents gl_MaxGeometryUniformComponents gl_MaxGeometryVaryingComponents ' +
            'gl_MaxImageSamples gl_MaxImageUnits gl_MaxLights gl_MaxPatchVertices gl_MaxProgramTexelOffset ' +
            'gl_MaxTessControlAtomicCounterBuffers gl_MaxTessControlAtomicCounters gl_MaxTessControlImageUniforms ' +
            'gl_MaxTessControlInputComponents gl_MaxTessControlOutputComponents gl_MaxTessControlTextureImageUnits ' +
            'gl_MaxTessControlTotalOutputComponents gl_MaxTessControlUniformComponents ' +
            'gl_MaxTessEvaluationAtomicCounterBuffers gl_MaxTessEvaluationAtomicCounters ' +
            'gl_MaxTessEvaluationImageUniforms gl_MaxTessEvaluationInputComponents gl_MaxTessEvaluationOutputComponents ' +
            'gl_MaxTessEvaluationTextureImageUnits gl_MaxTessEvaluationUniformComponents ' +
            'gl_MaxTessGenLevel gl_MaxTessPatchComponents gl_MaxTextureCoords gl_MaxTextureImageUnits ' +
            'gl_MaxTextureUnits gl_MaxVaryingComponents gl_MaxVaryingFloats gl_MaxVaryingVectors ' +
            'gl_MaxVertexAtomicCounterBuffers gl_MaxVertexAtomicCounters gl_MaxVertexAttribs ' +
            'gl_MaxVertexImageUniforms gl_MaxVertexOutputComponents gl_MaxVertexTextureImageUnits ' +
            'gl_MaxVertexUniformComponents gl_MaxVertexUniformVectors gl_MaxViewports gl_MinProgramTexelOffset' +
            'gl_ModelViewMatrix gl_ModelViewMatrixInverse gl_ModelViewMatrixInverseTranspose ' +
            'gl_ModelViewMatrixTranspose gl_ModelViewProjectionMatrix gl_ModelViewProjectionMatrixInverse ' +
            'gl_ModelViewProjectionMatrixInverseTranspose gl_ModelViewProjectionMatrixTranspose ' +
            'gl_MultiTexCoord0 gl_MultiTexCoord1 gl_MultiTexCoord2 gl_MultiTexCoord3 gl_MultiTexCoord4 ' +
            'gl_MultiTexCoord5 gl_MultiTexCoord6 gl_MultiTexCoord7 gl_Normal gl_NormalMatrix ' +
            'gl_NormalScale gl_ObjectPlaneQ gl_ObjectPlaneR gl_ObjectPlaneS gl_ObjectPlaneT gl_PatchVerticesIn ' +
            'gl_PerVertex gl_Point gl_PointCoord gl_PointSize gl_Position gl_PrimitiveID gl_PrimitiveIDIn ' +
            'gl_ProjectionMatrix gl_ProjectionMatrixInverse gl_ProjectionMatrixInverseTranspose ' +
            'gl_ProjectionMatrixTranspose gl_SampleID gl_SampleMask gl_SampleMaskIn gl_SamplePosition ' +
            'gl_SecondaryColor gl_TessCoord gl_TessLevelInner gl_TessLevelOuter gl_TexCoord gl_TextureEnvColor ' +
            'gl_TextureMatrixInverseTranspose gl_TextureMatrixTranspose gl_Vertex gl_VertexID ' +
            'gl_ViewportIndex gl_in gl_out EmitStreamVertex EmitVertex EndPrimitive EndStreamPrimitive ' +
            'abs acos acosh all any asin asinh atan atanh atomicCounter atomicCounterDecrement ' +
            'atomicCounterIncrement barrier bitCount bitfieldExtract bitfieldInsert bitfieldReverse ' +
            'ceil clamp cos cosh cross dFdx dFdy degrees determinant distance dot equal exp exp2 faceforward ' +
            'findLSB findMSB floatBitsToInt floatBitsToUint floor fma fract frexp ftransform fwidth greaterThan ' +
            'greaterThanEqual imageAtomicAdd imageAtomicAnd imageAtomicCompSwap imageAtomicExchange ' +
            'imageAtomicMax imageAtomicMin imageAtomicOr imageAtomicXor imageLoad imageStore imulExtended ' +
            'intBitsToFloat interpolateAtCentroid interpolateAtOffset interpolateAtSample inverse inversesqrt ' +
            'isinf isnan ldexp length lessThan lessThanEqual log log2 matrixCompMult max memoryBarrier ' +
            'min mix mod modf noise1 noise2 noise3 noise4 normalize not notEqual outerProduct packDouble2x32 ' +
            'packHalf2x16 packSnorm2x16 packSnorm4x8 packUnorm2x16 packUnorm4x8 pow radians reflect refract ' +
            'round roundEven shadow1D shadow1DLod shadow1DProj shadow1DProjLod shadow2D shadow2DLod shadow2DProj ' +
            'shadow2DProjLod sign sin sinh smoothstep sqrt step tan tanh texelFetch texelFetchOffset texture ' +
            'texture1D texture1DLod texture1DProj texture1DProjLod texture2D texture2DLod texture2DProj ' +
            'texture2DProjLod texture3D texture3DLod texture3DProj texture3DProjLod textureCube textureCubeLod ' +
            'textureGather textureGatherOffset textureGatherOffsets textureGrad textureGradOffset textureLod ' +
            'textureLodOffset textureOffset textureProj textureProjGrad textureProjGradOffset textureProjLod ' +
            'textureProjLodOffset textureProjOffset textureQueryLod textureSize transpose trunc uaddCarry ' +
            'uintBitsToFloat umulExtended unpackDouble2x32 unpackHalf2x16 unpackSnorm2x16 unpackSnorm4x8 ' +
            'unpackUnorm2x16 unpackUnorm4x8 usubBorrow gl_TextureMatrix gl_TextureMatrixInverse',
            literal: 'true false'
        },
        illegal: '"',
        contains: [
            hljs.C_LINE_COMMENT_MODE,
            hljs.C_BLOCK_COMMENT_MODE,
            hljs.C_NUMBER_MODE, {
                className: 'preprocessor',
                begin: '#',
                end: '$'
            }
        ]
    };
});
hljs.registerLanguage('go', function (hljs) {
    var GO_KEYWORDS = {
        keyword: 'break default func interface select case map struct chan else goto package switch ' +
        'const fallthrough if range type continue for import return var go defer',
        constant: 'true false iota nil',
        typename: 'bool byte complex64 complex128 float32 float64 int8 int16 int32 int64 string uint8 ' +
        'uint16 uint32 uint64 int uint uintptr rune',
        built_in: 'append cap close complex copy imag len make new panic print println real recover delete'
    };
    return {
        aliases: ["golang"],
        keywords: GO_KEYWORDS,
        illegal: '</',
        contains: [
            hljs.C_LINE_COMMENT_MODE,
            hljs.C_BLOCK_COMMENT_MODE,
            hljs.QUOTE_STRING_MODE, {
                className: 'string',
                begin: '\'',
                end: '[^\\\\]\''
            }, {
                className: 'string',
                begin: '`',
                end: '`'
            }, {
                className: 'number',
                begin: hljs.C_NUMBER_RE + '[dflsi]?',
                relevance: 0
            },
            hljs.C_NUMBER_MODE
        ]
    };
});
hljs.registerLanguage('gradle', function (hljs) {
    return {
        case_insensitive: true,
        keywords: {
            keyword: 'task project allprojects subprojects artifacts buildscript configurations ' +
            'dependencies repositories sourceSets description delete from into include ' +
            'exclude source classpath destinationDir includes options sourceCompatibility ' +
            'targetCompatibility group flatDir doLast doFirst flatten todir fromdir ant ' +
            'def abstract break case catch continue default do else extends final finally ' +
            'for if implements instanceof native new private protected public return static ' +
            'switch synchronized throw throws transient try volatile while strictfp package ' +
            'import false null super this true antlrtask checkstyle codenarc copy boolean ' +
            'byte char class double float int interface long short void compile runTime ' +
            'file fileTree abs any append asList asWritable call collect compareTo count ' +
            'div dump each eachByte eachFile eachLine every find findAll flatten getAt ' +
            'getErr getIn getOut getText grep immutable inject inspect intersect invokeMethods ' +
            'isCase join leftShift minus multiply newInputStream newOutputStream newPrintWriter ' +
            'newReader newWriter next plus pop power previous print println push putAt read ' +
            'readBytes readLines reverse reverseEach round size sort splitEachLine step subMap ' +
            'times toInteger toList tokenize upto waitForOrKill withPrintWriter withReader ' +
            'withStream withWriter withWriterAppend write writeLine'
        },
        contains: [
            hljs.C_LINE_COMMENT_MODE,
            hljs.C_BLOCK_COMMENT_MODE,
            hljs.APOS_STRING_MODE,
            hljs.QUOTE_STRING_MODE,
            hljs.NUMBER_MODE,
            hljs.REGEXP_MODE

        ]
    }
});
hljs.registerLanguage('groovy', function (hljs) {
    return {
        keywords: {
            typename: 'byte short char int long boolean float double void',
            literal: 'true false null',
            keyword: // groovy specific keywords
            'def as in assert trait ' +
                // common keywords with Java
            'super this abstract static volatile transient public private protected synchronized final ' +
            'class interface enum if else for while switch case break default continue ' +
            'throw throws try catch finally implements extends new import package return instanceof'
        },

        contains: [
            hljs.C_LINE_COMMENT_MODE, {
                className: 'javadoc',
                begin: '/\\*\\*',
                end: '\\*//*',
                relevance: 0,
                contains: [{
                    className: 'javadoctag',
                    begin: '(^|\\s)@[A-Za-z]+'
                }]
            },
            hljs.C_BLOCK_COMMENT_MODE, {
                className: 'string',
                begin: '"""',
                end: '"""'
            }, {
                className: 'string',
                begin: "'''",
                end: "'''"
            }, {
                className: 'string',
                begin: "\\$/",
                end: "/\\$",
                relevance: 10
            },
            hljs.APOS_STRING_MODE, {
                className: 'regexp',
                begin: /~?\/[^\/\n]+\//,
                contains: [
                    hljs.BACKSLASH_ESCAPE
                ]
            },
            hljs.QUOTE_STRING_MODE, {
                className: 'shebang',
                begin: "^#!/usr/bin/env",
                end: '$',
                illegal: '\n'
            },
            hljs.BINARY_NUMBER_MODE, {
                className: 'class',
                beginKeywords: 'class interface trait enum',
                end: '{',
                illegal: ':',
                contains: [{
                    beginKeywords: 'extends implements'
                },
                    hljs.UNDERSCORE_TITLE_MODE,
                ]
            },
            hljs.C_NUMBER_MODE, {
                className: 'annotation',
                begin: '@[A-Za-z]+'
            }, {
                // highlight map keys and named parameters as strings
                className: 'string',
                begin: /[^\?]{0}[A-Za-z0-9_$]+ *:/
            }, {
                // catch middle element of the ternary operator
                // to avoid highlight it as a label, named parameter, or map key
                begin: /\?/,
                end: /\:/
            }, {
                // highlight labeled statements
                className: 'label',
                begin: '^\\s*[A-Za-z0-9_$]+:',
                relevance: 0
            },
        ]
    }
});
hljs.registerLanguage('haml', // TODO support filter tags like :javascript, support inline HTML
    function (hljs) {
        return {
            case_insensitive: true,
            contains: [{
                className: 'doctype',
                begin: '^!!!( (5|1\\.1|Strict|Frameset|Basic|Mobile|RDFa|XML\\b.*))?$',
                relevance: 10
            }, {
                className: 'comment',
                // FIXME these comments should be allowed to span indented lines
                begin: '^\\s*(!=#|=#|-#|/).*$',
                relevance: 0
            }, {
                begin: '^\\s*(-|=|!=)(?!#)',
                starts: {
                    end: '\\n',
                    subLanguage: 'ruby'
                }
            }, {
                className: 'tag',
                begin: '^\\s*%',
                contains: [{
                    className: 'title',
                    begin: '\\w+'
                }, {
                    className: 'value',
                    begin: '[#\\.]\\w+'
                }, {
                    begin: '{\\s*',
                    end: '\\s*}',
                    excludeEnd: true,
                    contains: [{
                        //className: 'attribute',
                        begin: ':\\w+\\s*=>',
                        end: ',\\s+',
                        returnBegin: true,
                        endsWithParent: true,
                        contains: [{
                            className: 'symbol',
                            begin: ':\\w+'
                        }, {
                            className: 'string',
                            begin: '"',
                            end: '"'
                        }, {
                            className: 'string',
                            begin: '\'',
                            end: '\''
                        }, {
                            begin: '\\w+',
                            relevance: 0
                        }]
                    }]
                }, {
                    begin: '\\(\\s*',
                    end: '\\s*\\)',
                    excludeEnd: true,
                    contains: [{
                        //className: 'attribute',
                        begin: '\\w+\\s*=',
                        end: '\\s+',
                        returnBegin: true,
                        endsWithParent: true,
                        contains: [{
                            className: 'attribute',
                            begin: '\\w+',
                            relevance: 0
                        }, {
                            className: 'string',
                            begin: '"',
                            end: '"'
                        }, {
                            className: 'string',
                            begin: '\'',
                            end: '\''
                        }, {
                            begin: '\\w+',
                            relevance: 0
                        }]
                    }]
                }]
            }, {
                className: 'bullet',
                begin: '^\\s*[=~]\\s*',
                relevance: 0
            }, {
                begin: '#{',
                starts: {
                    end: '}',
                    subLanguage: 'ruby'
                }
            }]
        };
    });
hljs.registerLanguage('handlebars', function (hljs) {
    var EXPRESSION_KEYWORDS = 'each in with if else unless bindattr action collection debugger log outlet template unbound view yield';
    return {
        aliases: ['hbs', 'html.hbs', 'html.handlebars'],
        case_insensitive: true,
        subLanguage: 'xml',
        subLanguageMode: 'continuous',
        contains: [{
            className: 'expression',
            begin: '{{',
            end: '}}',
            contains: [{
                className: 'begin-block',
                begin: '\#[a-zA-Z\-\ \.]+',
                keywords: EXPRESSION_KEYWORDS
            }, {
                className: 'string',
                begin: '"',
                end: '"'
            }, {
                className: 'end-block',
                begin: '\\\/[a-zA-Z\-\ \.]+',
                keywords: EXPRESSION_KEYWORDS
            }, {
                className: 'variable',
                begin: '[a-zA-Z\-\.]+',
                keywords: EXPRESSION_KEYWORDS
            }]
        }]
    };
});
hljs.registerLanguage('haskell', function (hljs) {

    var COMMENT = {
        className: 'comment',
        variants: [{
            begin: '--',
            end: '$'
        }, {
            begin: '{-',
            end: '-}',
            contains: ['self']
        }]
    };

    var PRAGMA = {
        className: 'pragma',
        begin: '{-#',
        end: '#-}'
    };

    var PREPROCESSOR = {
        className: 'preprocessor',
        begin: '^#',
        end: '$'
    };

    var CONSTRUCTOR = {
        className: 'type',
        begin: '\\b[A-Z][\\w\']*', // TODO: other constructors (build-in, infix).
        relevance: 0
    };

    var LIST = {
        className: 'container',
        begin: '\\(',
        end: '\\)',
        illegal: '"',
        contains: [
            PRAGMA,
            COMMENT,
            PREPROCESSOR, {
                className: 'type',
                begin: '\\b[A-Z][\\w]*(\\((\\.\\.|,|\\w+)\\))?'
            },
            hljs.inherit(hljs.TITLE_MODE, {
                begin: '[_a-z][\\w\']*'
            })
        ]
    };

    var RECORD = {
        className: 'container',
        begin: '{',
        end: '}',
        contains: LIST.contains
    };

    return {
        aliases: ['hs'],
        keywords: 'let in if then else case of where do module import hiding ' +
        'qualified type data newtype deriving class instance as default ' +
        'infix infixl infixr foreign export ccall stdcall cplusplus ' +
        'jvm dotnet safe unsafe family forall mdo proc rec',
        contains: [

            // Top-level constructions.

            {
                className: 'module',
                begin: '\\bmodule\\b',
                end: 'where',
                keywords: 'module where',
                contains: [LIST, COMMENT],
                illegal: '\\W\\.|;'
            }, {
                className: 'import',
                begin: '\\bimport\\b',
                end: '$',
                keywords: 'import|0 qualified as hiding',
                contains: [LIST, COMMENT],
                illegal: '\\W\\.|;'
            },

            {
                className: 'class',
                begin: '^(\\s*)?(class|instance)\\b',
                end: 'where',
                keywords: 'class family instance where',
                contains: [CONSTRUCTOR, LIST, COMMENT]
            }, {
                className: 'typedef',
                begin: '\\b(data|(new)?type)\\b',
                end: '$',
                keywords: 'data family type newtype deriving',
                contains: [PRAGMA, COMMENT, CONSTRUCTOR, LIST, RECORD]
            }, {
                className: 'default',
                beginKeywords: 'default',
                end: '$',
                contains: [CONSTRUCTOR, LIST, COMMENT]
            }, {
                className: 'infix',
                beginKeywords: 'infix infixl infixr',
                end: '$',
                contains: [hljs.C_NUMBER_MODE, COMMENT]
            }, {
                className: 'foreign',
                begin: '\\bforeign\\b',
                end: '$',
                keywords: 'foreign import export ccall stdcall cplusplus jvm ' +
                'dotnet safe unsafe',
                contains: [CONSTRUCTOR, hljs.QUOTE_STRING_MODE, COMMENT]
            }, {
                className: 'shebang',
                begin: '#!\\/usr\\/bin\\/env\ runhaskell',
                end: '$'
            },

            // "Whitespaces".

            PRAGMA,
            COMMENT,
            PREPROCESSOR,

            // Literals and names.

            // TODO: characters.
            hljs.QUOTE_STRING_MODE,
            hljs.C_NUMBER_MODE,
            CONSTRUCTOR,
            hljs.inherit(hljs.TITLE_MODE, {
                begin: '^[_a-z][\\w\']*'
            }),

            {
                begin: '->|<-'
            } // No markup, relevance booster
        ]
    };
});
hljs.registerLanguage('haxe', function (hljs) {
    var IDENT_RE = '[a-zA-Z_$][a-zA-Z0-9_$]*';
    var IDENT_FUNC_RETURN_TYPE_RE = '([*]|[a-zA-Z_$][a-zA-Z0-9_$]*)';

    return {
        aliases: ['hx'],
        keywords: {
            keyword: 'break callback case cast catch class continue default do dynamic else enum extends extern ' +
            'for function here if implements import in inline interface never new override package private ' +
            'public return static super switch this throw trace try typedef untyped using var while',
            literal: 'true false null'
        },
        contains: [
            hljs.APOS_STRING_MODE,
            hljs.QUOTE_STRING_MODE,
            hljs.C_LINE_COMMENT_MODE,
            hljs.C_BLOCK_COMMENT_MODE,
            hljs.C_NUMBER_MODE, {
                className: 'class',
                beginKeywords: 'class interface',
                end: '{',
                excludeEnd: true,
                contains: [{
                    beginKeywords: 'extends implements'
                },
                    hljs.TITLE_MODE
                ]
            }, {
                className: 'preprocessor',
                begin: '#',
                end: '$',
                keywords: 'if else elseif end error'
            }, {
                className: 'function',
                beginKeywords: 'function',
                end: '[{;]',
                excludeEnd: true,
                illegal: '\\S',
                contains: [
                    hljs.TITLE_MODE, {
                        className: 'params',
                        begin: '\\(',
                        end: '\\)',
                        contains: [
                            hljs.APOS_STRING_MODE,
                            hljs.QUOTE_STRING_MODE,
                            hljs.C_LINE_COMMENT_MODE,
                            hljs.C_BLOCK_COMMENT_MODE
                        ]
                    }, {
                        className: 'type',
                        begin: ':',
                        end: IDENT_FUNC_RETURN_TYPE_RE,
                        relevance: 10
                    }
                ]
            }
        ]
    };
});
hljs.registerLanguage('http', function (hljs) {
    return {
        aliases: ['https'],
        illegal: '\\S',
        contains: [{
            className: 'status',
            begin: '^HTTP/[0-9\\.]+',
            end: '$',
            contains: [{
                className: 'number',
                begin: '\\b\\d{3}\\b'
            }]
        }, {
            className: 'request',
            begin: '^[A-Z]+ (.*?) HTTP/[0-9\\.]+$',
            returnBegin: true,
            end: '$',
            contains: [{
                className: 'string',
                begin: ' ',
                end: ' ',
                excludeBegin: true,
                excludeEnd: true
            }]
        }, {
            className: 'attribute',
            begin: '^\\w',
            end: ': ',
            excludeEnd: true,
            illegal: '\\n|\\s|=',
            starts: {
                className: 'string',
                end: '$'
            }
        }, {
            begin: '\\n\\n',
            starts: {
                subLanguage: '',
                endsWithParent: true
            }
        }]
    };
});
hljs.registerLanguage('ini', function (hljs) {
    return {
        case_insensitive: true,
        illegal: /\S/,
        contains: [{
            className: 'comment',
            begin: ';',
            end: '$'
        }, {
            className: 'title',
            begin: '^\\[',
            end: '\\]'
        }, {
            className: 'setting',
            begin: '^[a-z0-9\\[\\]_-]+[ \\t]*=[ \\t]*',
            end: '$',
            contains: [{
                className: 'value',
                endsWithParent: true,
                keywords: 'on off true false yes no',
                contains: [hljs.QUOTE_STRING_MODE, hljs.NUMBER_MODE],
                relevance: 0
            }]
        }]
    };
});
hljs.registerLanguage('java', function (hljs) {
    var GENERIC_IDENT_RE = hljs.UNDERSCORE_IDENT_RE + '(<' + hljs.UNDERSCORE_IDENT_RE + '>)?';
    var KEYWORDS =
        'false synchronized int abstract float private char boolean static null if const ' +
        'for true while long strictfp finally protected import native final void ' +
        'enum else break transient catch instanceof byte super volatile case assert short ' +
        'package default double public try this switch continue throws protected public private';

    // https://docs.oracle.com/javase/7/docs/technotes/guides/language/underscores-literals.html
    var JAVA_NUMBER_RE = '(\\b(0b[01_]+)|\\b0[xX][a-fA-F0-9_]+|(\\b[\\d_]+(\\.[\\d_]*)?|\\.[\\d_]+)([eE][-+]?\\d+)?)[lLfF]?'; // 0b..., 0x..., 0..., decimal, float
    var JAVA_NUMBER_MODE = {
        className: 'number',
        begin: JAVA_NUMBER_RE,
        relevance: 0
    };

    return {
        aliases: ['jsp'],
        keywords: KEYWORDS,
        illegal: /<\//,
        contains: [{
            className: 'javadoc',
            begin: '/\\*\\*',
            end: '\\*/',
            relevance: 0,
            contains: [{
                className: 'javadoctag',
                begin: '(^|\\s)@[A-Za-z]+'
            }]
        },
            hljs.C_LINE_COMMENT_MODE,
            hljs.C_BLOCK_COMMENT_MODE,
            hljs.APOS_STRING_MODE,
            hljs.QUOTE_STRING_MODE, {
                className: 'class',
                beginKeywords: 'class interface',
                end: /[{;=]/,
                excludeEnd: true,
                keywords: 'class interface',
                illegal: /[:"\[\]]/,
                contains: [{
                    beginKeywords: 'extends implements'
                },
                    hljs.UNDERSCORE_TITLE_MODE
                ]
            }, {
                // Expression keywords prevent 'keyword Name(...)' from being
                // recognized as a function definition
                beginKeywords: 'new throw return',
                relevance: 0
            }, {
                className: 'function',
                begin: '(' + GENERIC_IDENT_RE + '\\s+)+' + hljs.UNDERSCORE_IDENT_RE + '\\s*\\(',
                returnBegin: true,
                end: /[{;=]/,
                excludeEnd: true,
                keywords: KEYWORDS,
                contains: [{
                    begin: hljs.UNDERSCORE_IDENT_RE + '\\s*\\(',
                    returnBegin: true,
                    relevance: 0,
                    contains: [hljs.UNDERSCORE_TITLE_MODE]
                }, {
                    className: 'params',
                    begin: /\(/,
                    end: /\)/,
                    keywords: KEYWORDS,
                    relevance: 0,
                    contains: [
                        hljs.APOS_STRING_MODE,
                        hljs.QUOTE_STRING_MODE,
                        hljs.C_NUMBER_MODE,
                        hljs.C_BLOCK_COMMENT_MODE
                    ]
                },
                    hljs.C_LINE_COMMENT_MODE,
                    hljs.C_BLOCK_COMMENT_MODE
                ]
            },
            JAVA_NUMBER_MODE, {
                className: 'annotation',
                begin: '@[A-Za-z]+'
            }
        ]
    };
});
hljs.registerLanguage('javascript', function (hljs) {
    return {
        aliases: ['js'],
        keywords: {
            keyword: 'in if for while finally var new function do return void else break catch ' +
            'instanceof with throw case default try this switch continue typeof delete ' +
            'let yield const class export as',
            literal: 'true false null undefined NaN Infinity',
            built_in: 'eval isFinite isNaN parseFloat parseInt decodeURI decodeURIComponent ' +
            'encodeURI encodeURIComponent escape unescape Object Function Boolean Error ' +
            'EvalError InternalError RangeError ReferenceError StopIteration SyntaxError ' +
            'TypeError URIError Number Math Date String RegExp Array Float32Array ' +
            'Float64Array Int16Array Int32Array Int8Array Uint16Array Uint32Array ' +
            'Uint8Array Uint8ClampedArray ArrayBuffer DataView JSON Intl arguments require ' +
            'module console window document'
        },
        contains: [{
            className: 'pi',
            relevance: 10,
            variants: [{
                begin: /^\s*('|")use strict('|")/
            }, {
                begin: /^\s*('|")use asm('|")/
            }]
        },
            hljs.APOS_STRING_MODE,
            hljs.QUOTE_STRING_MODE,
            hljs.C_LINE_COMMENT_MODE,
            hljs.C_BLOCK_COMMENT_MODE,
            hljs.C_NUMBER_MODE, { // "value" container
                begin: '(' + hljs.RE_STARTERS_RE + '|\\b(case|return|throw)\\b)\\s*',
                keywords: 'return throw case',
                contains: [
                    hljs.C_LINE_COMMENT_MODE,
                    hljs.C_BLOCK_COMMENT_MODE,
                    hljs.REGEXP_MODE, { // E4X / JSX
                        begin: /</,
                        end: />\s*[);\]]/,
                        relevance: 0,
                        subLanguage: 'xml'
                    }
                ],
                relevance: 0
            }, {
                className: 'function',
                beginKeywords: 'function',
                end: /\{/,
                excludeEnd: true,
                contains: [
                    hljs.inherit(hljs.TITLE_MODE, {
                        begin: /[A-Za-z$_][0-9A-Za-z$_]*/
                    }), {
                        className: 'params',
                        begin: /\(/,
                        end: /\)/,
                        contains: [
                            hljs.C_LINE_COMMENT_MODE,
                            hljs.C_BLOCK_COMMENT_MODE
                        ],
                        illegal: /["'\(]/
                    }
                ],
                illegal: /\[|%/
            }, {
                begin: /\$[(.]/ // relevance booster for a pattern common to JS libs: `$(something)` and `$.something`
            }, {
                begin: '\\.' + hljs.IDENT_RE,
                relevance: 0 // hack: prevents detection of keywords after dots
            },
            // ECMAScript 6 modules import
            {
                beginKeywords: 'import',
                end: '[;$]',
                keywords: 'import from as',
                contains: [
                    hljs.APOS_STRING_MODE,
                    hljs.QUOTE_STRING_MODE
                ]
            }
        ]
    };
});
hljs.registerLanguage('json', function (hljs) {
    var LITERALS = {
        literal: 'true false null'
    };
    var TYPES = [
        hljs.QUOTE_STRING_MODE,
        hljs.C_NUMBER_MODE
    ];
    var VALUE_CONTAINER = {
        className: 'value',
        end: ',',
        endsWithParent: true,
        excludeEnd: true,
        contains: TYPES,
        keywords: LITERALS
    };
    var OBJECT = {
        begin: '{',
        end: '}',
        contains: [{
            className: 'attribute',
            begin: '\\s*"',
            end: '"\\s*:\\s*',
            excludeBegin: true,
            excludeEnd: true,
            contains: [hljs.BACKSLASH_ESCAPE],
            illegal: '\\n',
            starts: VALUE_CONTAINER
        }],
        illegal: '\\S'
    };
    var ARRAY = {
        begin: '\\[',
        end: '\\]',
        contains: [hljs.inherit(VALUE_CONTAINER, {
            className: null
        })], // inherit is also a workaround for a bug that makes shared modes with endsWithParent compile only the ending of one of the parents
        illegal: '\\S'
    };
    TYPES.splice(TYPES.length, 0, OBJECT, ARRAY);
    return {
        contains: TYPES,
        keywords: LITERALS,
        illegal: '\\S'
    };
});
hljs.registerLanguage('julia', function (hljs) {
    // Since there are numerous special names in Julia, it is too much trouble
    // to maintain them by hand. Hence these names (i.e. keywords, literals and
    // built-ins) are automatically generated from Julia (v0.3.0) itself through
    // following scripts for each.

    var KEYWORDS = {
        // # keyword generator
        // println("\"in\",")
        // for kw in Base.REPLCompletions.complete_keyword("")
        //     println("\"$kw\",")
        // end
        keyword: 'in abstract baremodule begin bitstype break catch ccall const continue do else elseif end export ' +
        'finally for function global if immutable import importall let local macro module quote return try type ' +
        'typealias using while',

        // # literal generator
        // println("\"true\",\n\"false\"")
        // for name in Base.REPLCompletions.completions("", 0)[1]
        //     try
        //         s = symbol(name)
        //         v = eval(s)
        //         if !isa(v, Function) &&
        //            !isa(v, DataType) &&
        //            !issubtype(typeof(v), Tuple) &&
        //            !isa(v, UnionType) &&
        //            !isa(v, Module) &&
        //            !isa(v, TypeConstructor) &&
        //            !isa(v, Colon)
        //             println("\"$name\",")
        //         end
        //     end
        // end
        literal: 'true false ANY ARGS CPU_CORES C_NULL DL_LOAD_PATH DevNull ENDIAN_BOM ENV I|0 Inf Inf16 Inf32 ' +
        'InsertionSort JULIA_HOME LOAD_PATH MS_ASYNC MS_INVALIDATE MS_SYNC MergeSort NaN NaN16 NaN32 OS_NAME QuickSort ' +
        'RTLD_DEEPBIND RTLD_FIRST RTLD_GLOBAL RTLD_LAZY RTLD_LOCAL RTLD_NODELETE RTLD_NOLOAD RTLD_NOW RoundDown ' +
        'RoundFromZero RoundNearest RoundToZero RoundUp STDERR STDIN STDOUT VERSION WORD_SIZE catalan cglobal e eu ' +
        'eulergamma golden im nothing pi γ π φ',

        // # built_in generator:
        // for name in Base.REPLCompletions.completions("", 0)[1]
        //     try
        //         v = eval(symbol(name))
        //         if isa(v, DataType)
        //             println("\"$name\",")
        //         end
        //     end
        // end
        built_in: 'ASCIIString AbstractArray AbstractRNG AbstractSparseArray Any ArgumentError Array Associative Base64Pipe ' +
        'Bidiagonal BigFloat BigInt BitArray BitMatrix BitVector Bool BoundsError Box CFILE Cchar Cdouble Cfloat Char ' +
        'CharString Cint Clong Clonglong ClusterManager Cmd Coff_t Colon Complex Complex128 Complex32 Complex64 ' +
        'Condition Cptrdiff_t Cshort Csize_t Cssize_t Cuchar Cuint Culong Culonglong Cushort Cwchar_t DArray DataType ' +
        'DenseArray Diagonal Dict DimensionMismatch DirectIndexString Display DivideError DomainError EOFError ' +
        'EachLine Enumerate ErrorException Exception Expr Factorization FileMonitor FileOffset Filter Float16 Float32 ' +
        'Float64 FloatRange FloatingPoint Function GetfieldNode GotoNode Hermitian IO IOBuffer IOStream IPv4 IPv6 ' +
        'InexactError Int Int128 Int16 Int32 Int64 Int8 IntSet Integer InterruptException IntrinsicFunction KeyError ' +
        'LabelNode LambdaStaticData LineNumberNode LoadError LocalProcess MIME MathConst MemoryError MersenneTwister ' +
        'Method MethodError MethodTable Module NTuple NewvarNode Nothing Number ObjectIdDict OrdinalRange ' +
        'OverflowError ParseError PollingFileWatcher ProcessExitedException ProcessGroup Ptr QuoteNode Range Range1 ' +
        'Ranges Rational RawFD Real Regex RegexMatch RemoteRef RepString RevString RopeString RoundingMode Set ' +
        'SharedArray Signed SparseMatrixCSC StackOverflowError Stat StatStruct StepRange String SubArray SubString ' +
        'SymTridiagonal Symbol SymbolNode Symmetric SystemError Task TextDisplay Timer TmStruct TopNode Triangular ' +
        'Tridiagonal Type TypeConstructor TypeError TypeName TypeVar UTF16String UTF32String UTF8String UdpSocket ' +
        'Uint Uint128 Uint16 Uint32 Uint64 Uint8 UndefRefError UndefVarError UniformScaling UnionType UnitRange ' +
        'Unsigned Vararg VersionNumber WString WeakKeyDict WeakRef Woodbury Zip'
    };

    // ref: http://julia.readthedocs.org/en/latest/manual/variables/#allowed-variable-names
    var VARIABLE_NAME_RE = "[A-Za-z_\\u00A1-\\uFFFF][A-Za-z_0-9\\u00A1-\\uFFFF]*";

    // placeholder for recursive self-reference
    var DEFAULT = {
        lexemes: VARIABLE_NAME_RE,
        keywords: KEYWORDS
    };

    var TYPE_ANNOTATION = {
        className: "type-annotation",
        begin: /::/
    };

    var SUBTYPE = {
        className: "subtype",
        begin: /<:/
    };

    // ref: http://julia.readthedocs.org/en/latest/manual/integers-and-floating-point-numbers/
    var NUMBER = {
        className: "number",
        // supported numeric literals:
        //  * binary literal (e.g. 0x10)
        //  * octal literal (e.g. 0o76543210)
        //  * hexadecimal literal (e.g. 0xfedcba876543210)
        //  * hexadecimal floating point literal (e.g. 0x1p0, 0x1.2p2)
        //  * decimal literal (e.g. 9876543210, 100_000_000)
        //  * floating pointe literal (e.g. 1.2, 1.2f, .2, 1., 1.2e10, 1.2e-10)
        begin: /(\b0x[\d_]*(\.[\d_]*)?|0x\.\d[\d_]*)p[-+]?\d+|\b0[box][a-fA-F0-9][a-fA-F0-9_]*|(\b\d[\d_]*(\.[\d_]*)?|\.\d[\d_]*)([eEfF][-+]?\d+)?/,
        relevance: 0
    };

    var CHAR = {
        className: "char",
        begin: /'(.|\\[xXuU][a-zA-Z0-9]+)'/
    };

    var INTERPOLATION = {
        className: 'subst',
        begin: /\$\(/,
        end: /\)/,
        keywords: KEYWORDS
    };

    var INTERPOLATED_VARIABLE = {
        className: 'variable',
        begin: "\\$" + VARIABLE_NAME_RE
    };

    // TODO: neatly escape normal code in string literal
    var STRING = {
        className: "string",
        contains: [hljs.BACKSLASH_ESCAPE, INTERPOLATION, INTERPOLATED_VARIABLE],
        variants: [{
            begin: /\w*"/,
            end: /"\w*/
        }, {
            begin: /\w*"""/,
            end: /"""\w*/
        }]
    };

    var COMMAND = {
        className: "string",
        contains: [hljs.BACKSLASH_ESCAPE, INTERPOLATION, INTERPOLATED_VARIABLE],
        begin: '`',
        end: '`'
    };

    var MACROCALL = {
        className: "macrocall",
        begin: "@" + VARIABLE_NAME_RE
    };

    var COMMENT = {
        className: "comment",
        variants: [{
            begin: "#=",
            end: "=#",
            relevance: 10
        }, {
            begin: '#',
            end: '$'
        }]
    };

    DEFAULT.contains = [
        NUMBER,
        CHAR,
        TYPE_ANNOTATION,
        SUBTYPE,
        STRING,
        COMMAND,
        MACROCALL,
        COMMENT,
        hljs.HASH_COMMENT_MODE
    ];
    INTERPOLATION.contains = DEFAULT.contains;

    return DEFAULT;
});
hljs.registerLanguage('lasso', function (hljs) {
    var LASSO_IDENT_RE = '[a-zA-Z_][a-zA-Z0-9_.]*';
    var LASSO_ANGLE_RE = '<\\?(lasso(script)?|=)';
    var LASSO_CLOSE_RE = '\\]|\\?>';
    var LASSO_KEYWORDS = {
        literal: 'true false none minimal full all void and or not ' +
        'bw nbw ew new cn ncn lt lte gt gte eq neq rx nrx ft',
        built_in: 'array date decimal duration integer map pair string tag xml null ' +
        'boolean bytes keyword list locale queue set stack staticarray ' +
        'local var variable global data self inherited',
        keyword: 'error_code error_msg error_pop error_push error_reset cache ' +
        'database_names database_schemanames database_tablenames define_tag ' +
        'define_type email_batch encode_set html_comment handle handle_error ' +
        'header if inline iterate ljax_target link link_currentaction ' +
        'link_currentgroup link_currentrecord link_detail link_firstgroup ' +
        'link_firstrecord link_lastgroup link_lastrecord link_nextgroup ' +
        'link_nextrecord link_prevgroup link_prevrecord log loop ' +
        'namespace_using output_none portal private protect records referer ' +
        'referrer repeating resultset rows search_args search_arguments ' +
        'select sort_args sort_arguments thread_atomic value_list while ' +
        'abort case else if_empty if_false if_null if_true loop_abort ' +
        'loop_continue loop_count params params_up return return_value ' +
        'run_children soap_definetag soap_lastrequest soap_lastresponse ' +
        'tag_name ascending average by define descending do equals ' +
        'frozen group handle_failure import in into join let match max ' +
        'min on order parent protected provide public require returnhome ' +
        'skip split_thread sum take thread to trait type where with ' +
        'yield yieldhome'
    };
    var HTML_COMMENT = {
        className: 'comment',
        begin: '<!--',
        end: '-->',
        relevance: 0
    };
    var LASSO_NOPROCESS = {
        className: 'preprocessor',
        begin: '\\[noprocess\\]',
        starts: {
            className: 'markup',
            end: '\\[/noprocess\\]',
            returnEnd: true,
            contains: [HTML_COMMENT]
        }
    };
    var LASSO_START = {
        className: 'preprocessor',
        begin: '\\[/noprocess|' + LASSO_ANGLE_RE
    };
    var LASSO_DATAMEMBER = {
        className: 'variable',
        begin: '\'' + LASSO_IDENT_RE + '\''
    };
    var LASSO_CODE = [
        hljs.C_LINE_COMMENT_MODE, {
            className: 'javadoc',
            begin: '/\\*\\*!',
            end: '\\*/',
            contains: [hljs.PHRASAL_WORDS_MODE]
        },
        hljs.C_BLOCK_COMMENT_MODE,
        hljs.inherit(hljs.C_NUMBER_MODE, {
            begin: hljs.C_NUMBER_RE + '|(-?infinity|nan)\\b'
        }),
        hljs.inherit(hljs.APOS_STRING_MODE, {
            illegal: null
        }),
        hljs.inherit(hljs.QUOTE_STRING_MODE, {
            illegal: null
        }), {
            className: 'string',
            begin: '`',
            end: '`'
        }, {
            className: 'variable',
            variants: [{
                begin: '[#$]' + LASSO_IDENT_RE
            }, {
                begin: '#',
                end: '\\d+',
                illegal: '\\W'
            }]
        }, {
            className: 'tag',
            begin: '::\\s*',
            end: LASSO_IDENT_RE,
            illegal: '\\W'
        }, {
            className: 'attribute',
            variants: [{
                begin: '-' + hljs.UNDERSCORE_IDENT_RE,
                relevance: 0
            }, {
                begin: '(\\.\\.\\.)'
            }]
        }, {
            className: 'subst',
            variants: [{
                begin: '->\\s*',
                contains: [LASSO_DATAMEMBER]
            }, {
                begin: ':=|/(?!\\w)=?|[-+*%=<>&|!?\\\\]+',
                relevance: 0
            }]
        }, {
            className: 'built_in',
            begin: '\\.\\.?\\s*',
            relevance: 0,
            contains: [LASSO_DATAMEMBER]
        }, {
            className: 'class',
            beginKeywords: 'define',
            returnEnd: true,
            end: '\\(|=>',
            contains: [
                hljs.inherit(hljs.TITLE_MODE, {
                    begin: hljs.UNDERSCORE_IDENT_RE + '(=(?!>))?'
                })
            ]
        }
    ];
    return {
        aliases: ['ls', 'lassoscript'],
        case_insensitive: true,
        lexemes: LASSO_IDENT_RE + '|&[lg]t;',
        keywords: LASSO_KEYWORDS,
        contains: [{
            className: 'preprocessor',
            begin: LASSO_CLOSE_RE,
            relevance: 0,
            starts: {
                className: 'markup',
                end: '\\[|' + LASSO_ANGLE_RE,
                returnEnd: true,
                relevance: 0,
                contains: [HTML_COMMENT]
            }
        },
            LASSO_NOPROCESS,
            LASSO_START, {
                className: 'preprocessor',
                begin: '\\[no_square_brackets',
                starts: {
                    end: '\\[/no_square_brackets\\]', // not implemented in the language
                    lexemes: LASSO_IDENT_RE + '|&[lg]t;',
                    keywords: LASSO_KEYWORDS,
                    contains: [{
                        className: 'preprocessor',
                        begin: LASSO_CLOSE_RE,
                        relevance: 0,
                        starts: {
                            className: 'markup',
                            end: '\\[noprocess\\]|' + LASSO_ANGLE_RE,
                            returnEnd: true,
                            contains: [HTML_COMMENT]
                        }
                    },
                        LASSO_NOPROCESS,
                        LASSO_START
                    ].concat(LASSO_CODE)
                }
            }, {
                className: 'preprocessor',
                begin: '\\[',
                relevance: 0
            }, {
                className: 'shebang',
                begin: '^#!.+lasso9\\b',
                relevance: 10
            }
        ].concat(LASSO_CODE)
    };
});
hljs.registerLanguage('less', function (hljs) {
    var IDENT_RE = '[\\w-]+'; // yes, Less identifiers may begin with a digit
    var INTERP_IDENT_RE = '(' + IDENT_RE + '|@{' + IDENT_RE + '})';

    /* Generic Modes */

    var RULES = [],
        VALUE = []; // forward def. for recursive modes

    var STRING_MODE = function (c) {
        return {
            // Less strings are not multiline (also include '~' for more consistent coloring of "escaped" strings)
            className: 'string',
            begin: '~?' + c + '.*?' + c
        };
    };

    var IDENT_MODE = function (name, begin, relevance) {
        return {
            className: name,
            begin: begin,
            relevance: relevance
        };
    };

    var FUNCT_MODE = function (name, ident, obj) {
        return hljs.inherit({
            className: name,
            begin: ident + '\\(',
            end: '\\(',
            returnBegin: true,
            excludeEnd: true,
            relevance: 0
        }, obj);
    };

    var PARENS_MODE = {
        // used only to properly balance nested parens inside mixin call, def. arg list
        begin: '\\(',
        end: '\\)',
        contains: VALUE,
        relevance: 0
    };

    // generic Less highlighter (used almost everywhere except selectors):
    VALUE.push(
        hljs.C_LINE_COMMENT_MODE,
        hljs.C_BLOCK_COMMENT_MODE,
        STRING_MODE("'"),
        STRING_MODE('"'),
        hljs.CSS_NUMBER_MODE, // fixme: it does not include dot for numbers like .5em :(
        IDENT_MODE('hexcolor', '#[0-9A-Fa-f]+\\b'),
        FUNCT_MODE('function', '(url|data-uri)', {
            starts: {
                className: 'string',
                end: '[\\)\\n]',
                excludeEnd: true
            }
        }),
        FUNCT_MODE('function', IDENT_RE),
        PARENS_MODE,
        IDENT_MODE('variable', '@@?' + IDENT_RE, 10),
        IDENT_MODE('variable', '@{' + IDENT_RE + '}'),
        IDENT_MODE('built_in', '~?`[^`]*?`'), // inline javascript (or whatever host language) *multiline* string
        { // @media features (it’s here to not duplicate things in AT_RULE_MODE with extra PARENS_MODE overriding):
            className: 'attribute',
            begin: IDENT_RE + '\\s*:',
            end: ':',
            returnBegin: true,
            excludeEnd: true
        }
    );

    var VALUE_WITH_RULESETS = VALUE.concat({
        begin: '{',
        end: '}',
        contains: RULES
    });

    var MIXIN_GUARD_MODE = {
        beginKeywords: 'when',
        endsWithParent: true,
        contains: [{
            beginKeywords: 'and not'
        }].concat(VALUE) // using this form to override VALUE’s 'function' match
    };

    /* Rule-Level Modes */

    var RULE_MODE = {
        className: 'attribute',
        begin: INTERP_IDENT_RE,
        end: ':',
        excludeEnd: true,
        contains: [hljs.C_LINE_COMMENT_MODE, hljs.C_BLOCK_COMMENT_MODE],
        illegal: /\S/,
        starts: {
            end: '[;}]',
            returnEnd: true,
            contains: VALUE,
            illegal: '[<=$]'
        }
    };

    var AT_RULE_MODE = {
        className: 'at_rule', // highlight only at-rule keyword
        begin: '@(import|media|charset|font-face|(-[a-z]+-)?keyframes|supports|document|namespace|page|viewport|host)\\b',
        starts: {
            end: '[;{}]',
            returnEnd: true,
            contains: VALUE,
            relevance: 0
        }
    };

    // variable definitions and calls
    var VAR_RULE_MODE = {
        className: 'variable',
        variants: [
            // using more strict pattern for higher relevance to increase chances of Less detection.
            // this is *the only* Less specific statement used in most of the sources, so...
            // (we’ll still often loose to the css-parser unless there's '//' comment,
            // simply because 1 variable just can't beat 99 properties :)
            {
                begin: '@' + IDENT_RE + '\\s*:',
                relevance: 15
            }, {
                begin: '@' + IDENT_RE
            }
        ],
        starts: {
            end: '[;}]',
            returnEnd: true,
            contains: VALUE_WITH_RULESETS
        }
    };

    var SELECTOR_MODE = {
        // first parse unambiguous selectors (i.e. those not starting with tag)
        // then fall into the scary lookahead-discriminator variant.
        // this mode also handles mixin definitions and calls
        variants: [{
            begin: '[\\.#:&\\[]',
            end: '[;{}]' // mixin calls end with ';'
        }, {
            begin: INTERP_IDENT_RE + '[^;]*{',
            end: '{'
        }],
        returnBegin: true,
        returnEnd: true,
        illegal: '[<=\'$"]',
        contains: [
            hljs.C_LINE_COMMENT_MODE,
            hljs.C_BLOCK_COMMENT_MODE,
            MIXIN_GUARD_MODE,
            IDENT_MODE('keyword', 'all\\b'),
            IDENT_MODE('variable', '@{' + IDENT_RE + '}'), // otherwise it’s identified as tag
            IDENT_MODE('tag', INTERP_IDENT_RE + '%?', 0), // '%' for more consistent coloring of @keyframes "tags"
            IDENT_MODE('id', '#' + INTERP_IDENT_RE),
            IDENT_MODE('class', '\\.' + INTERP_IDENT_RE, 0),
            IDENT_MODE('keyword', '&', 0),
            FUNCT_MODE('pseudo', ':not'),
            FUNCT_MODE('keyword', ':extend'),
            IDENT_MODE('pseudo', '::?' + INTERP_IDENT_RE), {
                className: 'attr_selector',
                begin: '\\[',
                end: '\\]'
            }, {
                begin: '\\(',
                end: '\\)',
                contains: VALUE_WITH_RULESETS
            }, // argument list of parametric mixins
            {
                begin: '!important'
            } // eat !important after mixin call or it will be colored as tag
        ]
    };

    RULES.push(
        hljs.C_LINE_COMMENT_MODE,
        hljs.C_BLOCK_COMMENT_MODE,
        AT_RULE_MODE,
        VAR_RULE_MODE,
        SELECTOR_MODE,
        RULE_MODE
    );

    return {
        case_insensitive: true,
        illegal: '[=>\'/<($"]',
        contains: RULES
    };
});
hljs.registerLanguage('lisp', function (hljs) {
    var LISP_IDENT_RE = '[a-zA-Z_\\-\\+\\*\\/\\<\\=\\>\\&\\#][a-zA-Z0-9_\\-\\+\\*\\/\\<\\=\\>\\&\\#!]*';
    var MEC_RE = '\\|[^]*?\\|';
    var LISP_SIMPLE_NUMBER_RE = '(\\-|\\+)?\\d+(\\.\\d+|\\/\\d+)?((d|e|f|l|s)(\\+|\\-)?\\d+)?';
    var SHEBANG = {
        className: 'shebang',
        begin: '^#!',
        end: '$'
    };
    var LITERAL = {
        className: 'literal',
        begin: '\\b(t{1}|nil)\\b'
    };
    var NUMBER = {
        className: 'number',
        variants: [{
            begin: LISP_SIMPLE_NUMBER_RE,
            relevance: 0
        }, {
            begin: '#b[0-1]+(/[0-1]+)?'
        }, {
            begin: '#o[0-7]+(/[0-7]+)?'
        }, {
            begin: '#x[0-9a-f]+(/[0-9a-f]+)?'
        }, {
            begin: '#c\\(' + LISP_SIMPLE_NUMBER_RE + ' +' + LISP_SIMPLE_NUMBER_RE,
            end: '\\)'
        }]
    };
    var STRING = hljs.inherit(hljs.QUOTE_STRING_MODE, {
        illegal: null
    });
    var COMMENT = {
        className: 'comment',
        begin: ';',
        end: '$',
        relevance: 0
    };
    var VARIABLE = {
        className: 'variable',
        begin: '\\*',
        end: '\\*'
    };
    var KEYWORD = {
        className: 'keyword',
        begin: '[:&]' + LISP_IDENT_RE
    };
    var MEC = {
        begin: MEC_RE
    };
    var QUOTED_LIST = {
        begin: '\\(',
        end: '\\)',
        contains: ['self', LITERAL, STRING, NUMBER]
    };
    var QUOTED = {
        className: 'quoted',
        contains: [NUMBER, STRING, VARIABLE, KEYWORD, QUOTED_LIST],
        variants: [{
            begin: '[\'`]\\(',
            end: '\\)'
        }, {
            begin: '\\(quote ',
            end: '\\)',
            keywords: 'quote'
        }, {
            begin: '\'' + MEC_RE
        }]
    };
    var QUOTED_ATOM = {
        className: 'quoted',
        begin: '\'' + LISP_IDENT_RE
    };
    var LIST = {
        className: 'list',
        begin: '\\(',
        end: '\\)'
    };
    var BODY = {
        endsWithParent: true,
        relevance: 0
    };
    LIST.contains = [{
        className: 'keyword',
        variants: [{
            begin: LISP_IDENT_RE
        }, {
            begin: MEC_RE
        }]
    },
        BODY
    ];
    BODY.contains = [QUOTED, QUOTED_ATOM, LIST, LITERAL, NUMBER, STRING, COMMENT, VARIABLE, KEYWORD, MEC];

    return {
        illegal: /\S/,
        contains: [
            NUMBER,
            SHEBANG,
            LITERAL,
            STRING,
            COMMENT,
            QUOTED,
            QUOTED_ATOM,
            LIST
        ]
    };
});
hljs.registerLanguage('livecodeserver', function (hljs) {
    var VARIABLE = {
        className: 'variable',
        begin: '\\b[gtps][A-Z]+[A-Za-z0-9_\\-]*\\b|\\$_[A-Z]+',
        relevance: 0
    };
    var COMMENT = {
        className: 'comment',
        end: '$',
        variants: [
            hljs.C_BLOCK_COMMENT_MODE,
            hljs.HASH_COMMENT_MODE, {
                begin: '--'
            }, {
                begin: '[^:]//'
            }
        ]
    };
    var TITLE1 = hljs.inherit(hljs.TITLE_MODE, {
        variants: [{
            begin: '\\b_*rig[A-Z]+[A-Za-z0-9_\\-]*'
        }, {
            begin: '\\b_[a-z0-9\\-]+'
        }]
    });
    var TITLE2 = hljs.inherit(hljs.TITLE_MODE, {
        begin: '\\b([A-Za-z0-9_\\-]+)\\b'
    });
    return {
        case_insensitive: false,
        keywords: {
            keyword: '$_COOKIE $_FILES $_GET $_GET_BINARY $_GET_RAW $_POST $_POST_BINARY $_POST_RAW $_SESSION $_SERVER ' +
            'codepoint codepoints segment segments codeunit codeunits sentence sentences trueWord trueWords paragraph ' +
            'after byte bytes english the until http forever descending using line real8 with seventh ' +
            'for stdout finally element word words fourth before black ninth sixth characters chars stderr ' +
            'uInt1 uInt1s uInt2 uInt2s stdin string lines relative rel any fifth items from middle mid ' +
            'at else of catch then third it file milliseconds seconds second secs sec int1 int1s int4 ' +
            'int4s internet int2 int2s normal text item last long detailed effective uInt4 uInt4s repeat ' +
            'end repeat URL in try into switch to words https token binfile each tenth as ticks tick ' +
            'system real4 by dateItems without char character ascending eighth whole dateTime numeric short ' +
            'first ftp integer abbreviated abbr abbrev private case while if',
            constant: 'SIX TEN FORMFEED NINE ZERO NONE SPACE FOUR FALSE COLON CRLF PI COMMA ENDOFFILE EOF EIGHT FIVE ' +
            'QUOTE EMPTY ONE TRUE RETURN CR LINEFEED RIGHT BACKSLASH NULL SEVEN TAB THREE TWO ' +
            'six ten formfeed nine zero none space four false colon crlf pi comma endoffile eof eight five ' +
            'quote empty one true return cr linefeed right backslash null seven tab three two ' +
            'RIVERSION RISTATE FILE_READ_MODE FILE_WRITE_MODE FILE_WRITE_MODE DIR_WRITE_MODE FILE_READ_UMASK ' +
            'FILE_WRITE_UMASK DIR_READ_UMASK DIR_WRITE_UMASK',
            operator: 'div mod wrap and or bitAnd bitNot bitOr bitXor among not in a an within ' +
            'contains ends with begins the keys of keys',
            built_in: 'put abs acos aliasReference annuity arrayDecode arrayEncode asin atan atan2 average avg avgDev base64Decode ' +
            'base64Encode baseConvert binaryDecode binaryEncode byteOffset byteToNum cachedURL cachedURLs charToNum ' +
            'cipherNames codepointOffset codepointProperty codepointToNum codeunitOffset commandNames compound compress ' +
            'constantNames cos date dateFormat decompress directories ' +
            'diskSpace DNSServers exp exp1 exp2 exp10 extents files flushEvents folders format functionNames geometricMean global ' +
            'globals hasMemory harmonicMean hostAddress hostAddressToName hostName hostNameToAddress isNumber ISOToMac itemOffset ' +
            'keys len length libURLErrorData libUrlFormData libURLftpCommand libURLLastHTTPHeaders libURLLastRHHeaders ' +
            'libUrlMultipartFormAddPart libUrlMultipartFormData libURLVersion lineOffset ln ln1 localNames log log2 log10 ' +
            'longFilePath lower macToISO matchChunk matchText matrixMultiply max md5Digest median merge millisec ' +
            'millisecs millisecond milliseconds min monthNames nativeCharToNum normalizeText num number numToByte numToChar ' +
            'numToCodepoint numToNativeChar offset open openfiles openProcesses openProcessIDs openSockets ' +
            'paragraphOffset paramCount param params peerAddress pendingMessages platform popStdDev populationStandardDeviation ' +
            'populationVariance popVariance processID random randomBytes replaceText result revCreateXMLTree revCreateXMLTreeFromFile ' +
            'revCurrentRecord revCurrentRecordIsFirst revCurrentRecordIsLast revDatabaseColumnCount revDatabaseColumnIsNull ' +
            'revDatabaseColumnLengths revDatabaseColumnNames revDatabaseColumnNamed revDatabaseColumnNumbered ' +
            'revDatabaseColumnTypes revDatabaseConnectResult revDatabaseCursors revDatabaseID revDatabaseTableNames ' +
            'revDatabaseType revDataFromQuery revdb_closeCursor revdb_columnbynumber revdb_columncount revdb_columnisnull ' +
            'revdb_columnlengths revdb_columnnames revdb_columntypes revdb_commit revdb_connect revdb_connections ' +
            'revdb_connectionerr revdb_currentrecord revdb_cursorconnection revdb_cursorerr revdb_cursors revdb_dbtype ' +
            'revdb_disconnect revdb_execute revdb_iseof revdb_isbof revdb_movefirst revdb_movelast revdb_movenext ' +
            'revdb_moveprev revdb_query revdb_querylist revdb_recordcount revdb_rollback revdb_tablenames ' +
            'revGetDatabaseDriverPath revNumberOfRecords revOpenDatabase revOpenDatabases revQueryDatabase ' +
            'revQueryDatabaseBlob revQueryResult revQueryIsAtStart revQueryIsAtEnd revUnixFromMacPath revXMLAttribute ' +
            'revXMLAttributes revXMLAttributeValues revXMLChildContents revXMLChildNames revXMLCreateTreeFromFileWithNamespaces ' +
            'revXMLCreateTreeWithNamespaces revXMLDataFromXPathQuery revXMLEvaluateXPath revXMLFirstChild revXMLMatchingNode ' +
            'revXMLNextSibling revXMLNodeContents revXMLNumberOfChildren revXMLParent revXMLPreviousSibling ' +
            'revXMLRootNode revXMLRPC_CreateRequest revXMLRPC_Documents revXMLRPC_Error ' +
            'revXMLRPC_GetHost revXMLRPC_GetMethod revXMLRPC_GetParam revXMLText revXMLRPC_Execute ' +
            'revXMLRPC_GetParamCount revXMLRPC_GetParamNode revXMLRPC_GetParamType revXMLRPC_GetPath revXMLRPC_GetPort ' +
            'revXMLRPC_GetProtocol revXMLRPC_GetRequest revXMLRPC_GetResponse revXMLRPC_GetSocket revXMLTree ' +
            'revXMLTrees revXMLValidateDTD revZipDescribeItem revZipEnumerateItems revZipOpenArchives round sampVariance ' +
            'sec secs seconds sentenceOffset sha1Digest shell shortFilePath sin specialFolderPath sqrt standardDeviation statRound ' +
            'stdDev sum sysError systemVersion tan tempName textDecode textEncode tick ticks time to tokenOffset toLower toUpper ' +
            'transpose truewordOffset trunc uniDecode uniEncode upper URLDecode URLEncode URLStatus uuid value variableNames ' +
            'variance version waitDepth weekdayNames wordOffset xsltApplyStylesheet xsltApplyStylesheetFromFile xsltLoadStylesheet ' +
            'xsltLoadStylesheetFromFile add breakpoint cancel clear local variable file word line folder directory URL close socket process ' +
            'combine constant convert create new alias folder directory decrypt delete variable word line folder ' +
            'directory URL dispatch divide do encrypt filter get include intersect kill libURLDownloadToFile ' +
            'libURLFollowHttpRedirects libURLftpUpload libURLftpUploadFile libURLresetAll libUrlSetAuthCallback ' +
            'libURLSetCustomHTTPHeaders libUrlSetExpect100 libURLSetFTPListCommand libURLSetFTPMode libURLSetFTPStopTime ' +
            'libURLSetStatusCallback load multiply socket prepare process post seek rel relative read from process rename ' +
            'replace require resetAll resolve revAddXMLNode revAppendXML revCloseCursor revCloseDatabase revCommitDatabase ' +
            'revCopyFile revCopyFolder revCopyXMLNode revDeleteFolder revDeleteXMLNode revDeleteAllXMLTrees ' +
            'revDeleteXMLTree revExecuteSQL revGoURL revInsertXMLNode revMoveFolder revMoveToFirstRecord revMoveToLastRecord ' +
            'revMoveToNextRecord revMoveToPreviousRecord revMoveToRecord revMoveXMLNode revPutIntoXMLNode revRollBackDatabase ' +
            'revSetDatabaseDriverPath revSetXMLAttribute revXMLRPC_AddParam revXMLRPC_DeleteAllDocuments revXMLAddDTD ' +
            'revXMLRPC_Free revXMLRPC_FreeAll revXMLRPC_DeleteDocument revXMLRPC_DeleteParam revXMLRPC_SetHost ' +
            'revXMLRPC_SetMethod revXMLRPC_SetPort revXMLRPC_SetProtocol revXMLRPC_SetSocket revZipAddItemWithData ' +
            'revZipAddItemWithFile revZipAddUncompressedItemWithData revZipAddUncompressedItemWithFile revZipCancel ' +
            'revZipCloseArchive revZipDeleteItem revZipExtractItemToFile revZipExtractItemToVariable revZipSetProgressCallback ' +
            'revZipRenameItem revZipReplaceItemWithData revZipReplaceItemWithFile revZipOpenArchive send set sort split start stop ' +
            'subtract union unload wait write'
        },
        contains: [
            VARIABLE, {
                className: 'keyword',
                begin: '\\bend\\sif\\b'
            }, {
                className: 'function',
                beginKeywords: 'function',
                end: '$',
                contains: [
                    VARIABLE,
                    TITLE2,
                    hljs.APOS_STRING_MODE,
                    hljs.QUOTE_STRING_MODE,
                    hljs.BINARY_NUMBER_MODE,
                    hljs.C_NUMBER_MODE,
                    TITLE1
                ]
            }, {
                className: 'function',
                beginKeywords: 'end',
                end: '$',
                contains: [
                    TITLE2,
                    TITLE1
                ]
            }, {
                className: 'command',
                beginKeywords: 'command on',
                end: '$',
                contains: [
                    VARIABLE,
                    TITLE2,
                    hljs.APOS_STRING_MODE,
                    hljs.QUOTE_STRING_MODE,
                    hljs.BINARY_NUMBER_MODE,
                    hljs.C_NUMBER_MODE,
                    TITLE1
                ]
            }, {
                className: 'command',
                beginKeywords: 'end',
                end: '$',
                contains: [
                    TITLE2,
                    TITLE1
                ]
            }, {
                className: 'preprocessor',
                begin: '<\\?rev|<\\?lc|<\\?livecode',
                relevance: 10
            }, {
                className: 'preprocessor',
                begin: '<\\?'
            }, {
                className: 'preprocessor',
                begin: '\\?>'
            },
            COMMENT,
            hljs.APOS_STRING_MODE,
            hljs.QUOTE_STRING_MODE,
            hljs.BINARY_NUMBER_MODE,
            hljs.C_NUMBER_MODE,
            TITLE1
        ],
        illegal: ';$|^\\[|^='
    };
});
hljs.registerLanguage('livescript', function (hljs) {
    var KEYWORDS = {
        keyword: // JS keywords
        'in if for while finally new do return else break catch instanceof throw try this ' +
        'switch continue typeof delete debugger case default function var with ' +
            // LiveScript keywords
        'then unless until loop of by when and or is isnt not it that otherwise from to til fallthrough super ' +
        'case default function var void const let enum export import native ' +
        '__hasProp __extends __slice __bind __indexOf',
        literal: // JS literals
        'true false null undefined ' +
            // LiveScript literals
        'yes no on off it that void',
        built_in: 'npm require console print module global window document'
    };
    var JS_IDENT_RE = '[A-Za-z$_](?:\-[0-9A-Za-z$_]|[0-9A-Za-z$_])*';
    var TITLE = hljs.inherit(hljs.TITLE_MODE, {
        begin: JS_IDENT_RE
    });
    var SUBST = {
        className: 'subst',
        begin: /#\{/,
        end: /}/,
        keywords: KEYWORDS
    };
    var SUBST_SIMPLE = {
        className: 'subst',
        begin: /#[A-Za-z$_]/,
        end: /(?:\-[0-9A-Za-z$_]|[0-9A-Za-z$_])*/,
        keywords: KEYWORDS
    };
    var EXPRESSIONS = [
        hljs.BINARY_NUMBER_MODE, {
            className: 'number',
            begin: '(\\b0[xX][a-fA-F0-9_]+)|(\\b\\d(\\d|_\\d)*(\\.(\\d(\\d|_\\d)*)?)?(_*[eE]([-+]\\d(_\\d|\\d)*)?)?[_a-z]*)',
            relevance: 0,
            starts: {
                end: '(\\s*/)?',
                relevance: 0
            } // a number tries to eat the following slash to prevent treating it as a regexp
        }, {
            className: 'string',
            variants: [{
                begin: /'''/,
                end: /'''/,
                contains: [hljs.BACKSLASH_ESCAPE]
            }, {
                begin: /'/,
                end: /'/,
                contains: [hljs.BACKSLASH_ESCAPE]
            }, {
                begin: /"""/,
                end: /"""/,
                contains: [hljs.BACKSLASH_ESCAPE, SUBST, SUBST_SIMPLE]
            }, {
                begin: /"/,
                end: /"/,
                contains: [hljs.BACKSLASH_ESCAPE, SUBST, SUBST_SIMPLE]
            }, {
                begin: /\\/,
                end: /(\s|$)/,
                excludeEnd: true
            }]
        }, {
            className: 'pi',
            variants: [{
                begin: '//',
                end: '//[gim]*',
                contains: [SUBST, hljs.HASH_COMMENT_MODE]
            }, {
                // regex can't start with space to parse x / 2 / 3 as two divisions
                // regex can't start with *, and it supports an "illegal" in the main mode
                begin: /\/(?![ *])(\\\/|.)*?\/[gim]*(?=\W|$)/
            }]
        }, {
            className: 'property',
            begin: '@' + JS_IDENT_RE
        }, {
            begin: '``',
            end: '``',
            excludeBegin: true,
            excludeEnd: true,
            subLanguage: 'javascript'
        }
    ];
    SUBST.contains = EXPRESSIONS;

    var PARAMS = {
        className: 'params',
        begin: '\\(',
        returnBegin: true,
        /* We need another contained nameless mode to not have every nested
         pair of parens to be called "params" */
        contains: [{
            begin: /\(/,
            end: /\)/,
            keywords: KEYWORDS,
            contains: ['self'].concat(EXPRESSIONS)
        }]
    };

    return {
        aliases: ['ls'],
        keywords: KEYWORDS,
        illegal: /\/\*/,
        contains: EXPRESSIONS.concat([{
            className: 'comment',
            begin: '\\/\\*',
            end: '\\*\\/'
        },
            hljs.HASH_COMMENT_MODE, {
                className: 'function',
                contains: [TITLE, PARAMS],
                returnBegin: true,
                variants: [{
                    begin: '(' + JS_IDENT_RE + '\\s*(?:=|:=)\\s*)?(\\(.*\\))?\\s*\\B\\->\\*?',
                    end: '\\->\\*?'
                }, {
                    begin: '(' + JS_IDENT_RE + '\\s*(?:=|:=)\\s*)?!?(\\(.*\\))?\\s*\\B[-~]{1,2}>\\*?',
                    end: '[-~]{1,2}>\\*?'
                }, {
                    begin: '(' + JS_IDENT_RE + '\\s*(?:=|:=)\\s*)?(\\(.*\\))?\\s*\\B!?[-~]{1,2}>\\*?',
                    end: '!?[-~]{1,2}>\\*?'
                }]
            }, {
                className: 'class',
                beginKeywords: 'class',
                end: '$',
                illegal: /[:="\[\]]/,
                contains: [{
                    beginKeywords: 'extends',
                    endsWithParent: true,
                    illegal: /[:="\[\]]/,
                    contains: [TITLE]
                },
                    TITLE
                ]
            }, {
                className: 'attribute',
                begin: JS_IDENT_RE + ':',
                end: ':',
                returnBegin: true,
                returnEnd: true,
                relevance: 0
            }
        ])
    };
});
hljs.registerLanguage('lua', function (hljs) {
    var OPENING_LONG_BRACKET = '\\[=*\\[';
    var CLOSING_LONG_BRACKET = '\\]=*\\]';
    var LONG_BRACKETS = {
        begin: OPENING_LONG_BRACKET,
        end: CLOSING_LONG_BRACKET,
        contains: ['self']
    };
    var COMMENTS = [{
        className: 'comment',
        begin: '--(?!' + OPENING_LONG_BRACKET + ')',
        end: '$'
    }, {
        className: 'comment',
        begin: '--' + OPENING_LONG_BRACKET,
        end: CLOSING_LONG_BRACKET,
        contains: [LONG_BRACKETS],
        relevance: 10
    }]
    return {
        lexemes: hljs.UNDERSCORE_IDENT_RE,
        keywords: {
            keyword: 'and break do else elseif end false for if in local nil not or repeat return then ' +
            'true until while',
            built_in: '_G _VERSION assert collectgarbage dofile error getfenv getmetatable ipairs load ' +
            'loadfile loadstring module next pairs pcall print rawequal rawget rawset require ' +
            'select setfenv setmetatable tonumber tostring type unpack xpcall coroutine debug ' +
            'io math os package string table'
        },
        contains: COMMENTS.concat([{
            className: 'function',
            beginKeywords: 'function',
            end: '\\)',
            contains: [
                hljs.inherit(hljs.TITLE_MODE, {
                    begin: '([_a-zA-Z]\\w*\\.)*([_a-zA-Z]\\w*:)?[_a-zA-Z]\\w*'
                }), {
                    className: 'params',
                    begin: '\\(',
                    endsWithParent: true,
                    contains: COMMENTS
                }
            ].concat(COMMENTS)
        },
            hljs.C_NUMBER_MODE,
            hljs.APOS_STRING_MODE,
            hljs.QUOTE_STRING_MODE, {
                className: 'string',
                begin: OPENING_LONG_BRACKET,
                end: CLOSING_LONG_BRACKET,
                contains: [LONG_BRACKETS],
                relevance: 5
            }
        ])
    };
});
hljs.registerLanguage('makefile', function (hljs) {
    var VARIABLE = {
        className: 'variable',
        begin: /\$\(/,
        end: /\)/,
        contains: [hljs.BACKSLASH_ESCAPE]
    };
    return {
        aliases: ['mk', 'mak'],
        contains: [
            hljs.HASH_COMMENT_MODE, {
                begin: /^\w+\s*\W*=/,
                returnBegin: true,
                relevance: 0,
                starts: {
                    className: 'constant',
                    end: /\s*\W*=/,
                    excludeEnd: true,
                    starts: {
                        end: /$/,
                        relevance: 0,
                        contains: [
                            VARIABLE
                        ]
                    }
                }
            }, {
                className: 'title',
                begin: /^[\w]+:\s*$/
            }, {
                className: 'phony',
                begin: /^\.PHONY:/,
                end: /$/,
                keywords: '.PHONY',
                lexemes: /[\.\w]+/
            }, {
                begin: /^\t+/,
                end: /$/,
                relevance: 0,
                contains: [
                    hljs.QUOTE_STRING_MODE,
                    VARIABLE
                ]
            }
        ]
    };
});
hljs.registerLanguage('mathematica', function (hljs) {
    return {
        aliases: ['mma'],
        lexemes: '(\\$|\\b)' + hljs.IDENT_RE + '\\b',
        keywords: 'AbelianGroup Abort AbortKernels AbortProtect Above Abs Absolute AbsoluteCorrelation AbsoluteCorrelationFunction AbsoluteCurrentValue AbsoluteDashing AbsoluteFileName AbsoluteOptions AbsolutePointSize AbsoluteThickness AbsoluteTime AbsoluteTiming AccountingForm Accumulate Accuracy AccuracyGoal ActionDelay ActionMenu ActionMenuBox ActionMenuBoxOptions Active ActiveItem ActiveStyle AcyclicGraphQ AddOnHelpPath AddTo AdjacencyGraph AdjacencyList AdjacencyMatrix AdjustmentBox AdjustmentBoxOptions AdjustTimeSeriesForecast AffineTransform After AiryAi AiryAiPrime AiryAiZero AiryBi AiryBiPrime AiryBiZero AlgebraicIntegerQ AlgebraicNumber AlgebraicNumberDenominator AlgebraicNumberNorm AlgebraicNumberPolynomial AlgebraicNumberTrace AlgebraicRules AlgebraicRulesData Algebraics AlgebraicUnitQ Alignment AlignmentMarker AlignmentPoint All AllowedDimensions AllowGroupClose AllowInlineCells AllowKernelInitialization AllowReverseGroupClose AllowScriptLevelChange AlphaChannel AlternatingGroup AlternativeHypothesis Alternatives AmbientLight Analytic AnchoredSearch And AndersonDarlingTest AngerJ AngleBracket AngularGauge Animate AnimationCycleOffset AnimationCycleRepetitions AnimationDirection AnimationDisplayTime AnimationRate AnimationRepetitions AnimationRunning Animator AnimatorBox AnimatorBoxOptions AnimatorElements Annotation Annuity AnnuityDue Antialiasing Antisymmetric Apart ApartSquareFree Appearance AppearanceElements AppellF1 Append AppendTo Apply ArcCos ArcCosh ArcCot ArcCoth ArcCsc ArcCsch ArcSec ArcSech ArcSin ArcSinDistribution ArcSinh ArcTan ArcTanh Arg ArgMax ArgMin ArgumentCountQ ARIMAProcess ArithmeticGeometricMean ARMAProcess ARProcess Array ArrayComponents ArrayDepth ArrayFlatten ArrayPad ArrayPlot ArrayQ ArrayReshape ArrayRules Arrays Arrow Arrow3DBox ArrowBox Arrowheads AspectRatio AspectRatioFixed Assert Assuming Assumptions AstronomicalData Asynchronous AsynchronousTaskObject AsynchronousTasks AtomQ Attributes AugmentedSymmetricPolynomial AutoAction AutoDelete AutoEvaluateEvents AutoGeneratedPackage AutoIndent AutoIndentSpacings AutoItalicWords AutoloadPath AutoMatch Automatic AutomaticImageSize AutoMultiplicationSymbol AutoNumberFormatting AutoOpenNotebooks AutoOpenPalettes AutorunSequencing AutoScaling AutoScroll AutoSpacing AutoStyleOptions AutoStyleWords Axes AxesEdge AxesLabel AxesOrigin AxesStyle Axis ' +
        'BabyMonsterGroupB Back Background BackgroundTasksSettings Backslash Backsubstitution Backward Band BandpassFilter BandstopFilter BarabasiAlbertGraphDistribution BarChart BarChart3D BarLegend BarlowProschanImportance BarnesG BarOrigin BarSpacing BartlettHannWindow BartlettWindow BaseForm Baseline BaselinePosition BaseStyle BatesDistribution BattleLemarieWavelet Because BeckmannDistribution Beep Before Begin BeginDialogPacket BeginFrontEndInteractionPacket BeginPackage BellB BellY Below BenfordDistribution BeniniDistribution BenktanderGibratDistribution BenktanderWeibullDistribution BernoulliB BernoulliDistribution BernoulliGraphDistribution BernoulliProcess BernsteinBasis BesselFilterModel BesselI BesselJ BesselJZero BesselK BesselY BesselYZero Beta BetaBinomialDistribution BetaDistribution BetaNegativeBinomialDistribution BetaPrimeDistribution BetaRegularized BetweennessCentrality BezierCurve BezierCurve3DBox BezierCurve3DBoxOptions BezierCurveBox BezierCurveBoxOptions BezierFunction BilateralFilter Binarize BinaryFormat BinaryImageQ BinaryRead BinaryReadList BinaryWrite BinCounts BinLists Binomial BinomialDistribution BinomialProcess BinormalDistribution BiorthogonalSplineWavelet BipartiteGraphQ BirnbaumImportance BirnbaumSaundersDistribution BitAnd BitClear BitGet BitLength BitNot BitOr BitSet BitShiftLeft BitShiftRight BitXor Black BlackmanHarrisWindow BlackmanNuttallWindow BlackmanWindow Blank BlankForm BlankNullSequence BlankSequence Blend Block BlockRandom BlomqvistBeta BlomqvistBetaTest Blue Blur BodePlot BohmanWindow Bold Bookmarks Boole BooleanConsecutiveFunction BooleanConvert BooleanCountingFunction BooleanFunction BooleanGraph BooleanMaxterms BooleanMinimize BooleanMinterms Booleans BooleanTable BooleanVariables BorderDimensions BorelTannerDistribution Bottom BottomHatTransform BoundaryStyle Bounds Box BoxBaselineShift BoxData BoxDimensions Boxed Boxes BoxForm BoxFormFormatTypes BoxFrame BoxID BoxMargins BoxMatrix BoxRatios BoxRotation BoxRotationPoint BoxStyle BoxWhiskerChart Bra BracketingBar BraKet BrayCurtisDistance BreadthFirstScan Break Brown BrownForsytheTest BrownianBridgeProcess BrowserCategory BSplineBasis BSplineCurve BSplineCurve3DBox BSplineCurveBox BSplineCurveBoxOptions BSplineFunction BSplineSurface BSplineSurface3DBox BubbleChart BubbleChart3D BubbleScale BubbleSizes BulletGauge BusinessDayQ ButterflyGraph ButterworthFilterModel Button ButtonBar ButtonBox ButtonBoxOptions ButtonCell ButtonContents ButtonData ButtonEvaluator ButtonExpandable ButtonFrame ButtonFunction ButtonMargins ButtonMinHeight ButtonNote ButtonNotebook ButtonSource ButtonStyle ButtonStyleMenuListing Byte ByteCount ByteOrdering ' +
        'C CachedValue CacheGraphics CalendarData CalendarType CallPacket CanberraDistance Cancel CancelButton CandlestickChart Cap CapForm CapitalDifferentialD CardinalBSplineBasis CarmichaelLambda Cases Cashflow Casoratian Catalan CatalanNumber Catch CauchyDistribution CauchyWindow CayleyGraph CDF CDFDeploy CDFInformation CDFWavelet Ceiling Cell CellAutoOverwrite CellBaseline CellBoundingBox CellBracketOptions CellChangeTimes CellContents CellContext CellDingbat CellDynamicExpression CellEditDuplicate CellElementsBoundingBox CellElementSpacings CellEpilog CellEvaluationDuplicate CellEvaluationFunction CellEventActions CellFrame CellFrameColor CellFrameLabelMargins CellFrameLabels CellFrameMargins CellGroup CellGroupData CellGrouping CellGroupingRules CellHorizontalScrolling CellID CellLabel CellLabelAutoDelete CellLabelMargins CellLabelPositioning CellMargins CellObject CellOpen CellPrint CellProlog Cells CellSize CellStyle CellTags CellularAutomaton CensoredDistribution Censoring Center CenterDot CentralMoment CentralMomentGeneratingFunction CForm ChampernowneNumber ChanVeseBinarize Character CharacterEncoding CharacterEncodingsPath CharacteristicFunction CharacteristicPolynomial CharacterRange Characters ChartBaseStyle ChartElementData ChartElementDataFunction ChartElementFunction ChartElements ChartLabels ChartLayout ChartLegends ChartStyle Chebyshev1FilterModel Chebyshev2FilterModel ChebyshevDistance ChebyshevT ChebyshevU Check CheckAbort CheckAll Checkbox CheckboxBar CheckboxBox CheckboxBoxOptions ChemicalData ChessboardDistance ChiDistribution ChineseRemainder ChiSquareDistribution ChoiceButtons ChoiceDialog CholeskyDecomposition Chop Circle CircleBox CircleDot CircleMinus CirclePlus CircleTimes CirculantGraph CityData Clear ClearAll ClearAttributes ClearSystemCache ClebschGordan ClickPane Clip ClipboardNotebook ClipFill ClippingStyle ClipPlanes ClipRange Clock ClockGauge ClockwiseContourIntegral Close Closed CloseKernels ClosenessCentrality Closing ClosingAutoSave ClosingEvent ClusteringComponents CMYKColor Coarse Coefficient CoefficientArrays CoefficientDomain CoefficientList CoefficientRules CoifletWavelet Collect Colon ColonForm ColorCombine ColorConvert ColorData ColorDataFunction ColorFunction ColorFunctionScaling Colorize ColorNegate ColorOutput ColorProfileData ColorQuantize ColorReplace ColorRules ColorSelectorSettings ColorSeparate ColorSetter ColorSetterBox ColorSetterBoxOptions ColorSlider ColorSpace Column ColumnAlignments ColumnBackgrounds ColumnForm ColumnLines ColumnsEqual ColumnSpacings ColumnWidths CommonDefaultFormatTypes Commonest CommonestFilter CommonUnits CommunityBoundaryStyle CommunityGraphPlot CommunityLabels CommunityRegionStyle CompatibleUnitQ CompilationOptions CompilationTarget Compile Compiled CompiledFunction Complement CompleteGraph CompleteGraphQ CompleteKaryTree CompletionsListPacket Complex Complexes ComplexExpand ComplexInfinity ComplexityFunction ComponentMeasurements ' +
        'ComponentwiseContextMenu Compose ComposeList ComposeSeries Composition CompoundExpression CompoundPoissonDistribution CompoundPoissonProcess CompoundRenewalProcess Compress CompressedData Condition ConditionalExpression Conditioned Cone ConeBox ConfidenceLevel ConfidenceRange ConfidenceTransform ConfigurationPath Congruent Conjugate ConjugateTranspose Conjunction Connect ConnectedComponents ConnectedGraphQ ConnesWindow ConoverTest ConsoleMessage ConsoleMessagePacket ConsolePrint Constant ConstantArray Constants ConstrainedMax ConstrainedMin ContentPadding ContentsBoundingBox ContentSelectable ContentSize Context ContextMenu Contexts ContextToFilename ContextToFileName Continuation Continue ContinuedFraction ContinuedFractionK ContinuousAction ContinuousMarkovProcess ContinuousTimeModelQ ContinuousWaveletData ContinuousWaveletTransform ContourDetect ContourGraphics ContourIntegral ContourLabels ContourLines ContourPlot ContourPlot3D Contours ContourShading ContourSmoothing ContourStyle ContraharmonicMean Control ControlActive ControlAlignment ControllabilityGramian ControllabilityMatrix ControllableDecomposition ControllableModelQ ControllerDuration ControllerInformation ControllerInformationData ControllerLinking ControllerManipulate ControllerMethod ControllerPath ControllerState ControlPlacement ControlsRendering ControlType Convergents ConversionOptions ConversionRules ConvertToBitmapPacket ConvertToPostScript ConvertToPostScriptPacket Convolve ConwayGroupCo1 ConwayGroupCo2 ConwayGroupCo3 CoordinateChartData CoordinatesToolOptions CoordinateTransform CoordinateTransformData CoprimeQ Coproduct CopulaDistribution Copyable CopyDirectory CopyFile CopyTag CopyToClipboard CornerFilter CornerNeighbors Correlation CorrelationDistance CorrelationFunction CorrelationTest Cos Cosh CoshIntegral CosineDistance CosineWindow CosIntegral Cot Coth Count CounterAssignments CounterBox CounterBoxOptions CounterClockwiseContourIntegral CounterEvaluator CounterFunction CounterIncrements CounterStyle CounterStyleMenuListing CountRoots CountryData Covariance CovarianceEstimatorFunction CovarianceFunction CoxianDistribution CoxIngersollRossProcess CoxModel CoxModelFit CramerVonMisesTest CreateArchive CreateDialog CreateDirectory CreateDocument CreateIntermediateDirectories CreatePalette CreatePalettePacket CreateScheduledTask CreateTemporary CreateWindow CriticalityFailureImportance CriticalitySuccessImportance CriticalSection Cross CrossingDetect CrossMatrix Csc Csch CubeRoot Cubics Cuboid CuboidBox Cumulant CumulantGeneratingFunction Cup CupCap Curl CurlyDoubleQuote CurlyQuote CurrentImage CurrentlySpeakingPacket CurrentValue CurvatureFlowFilter CurveClosed Cyan CycleGraph CycleIndexPolynomial Cycles CyclicGroup Cyclotomic Cylinder CylinderBox CylindricalDecomposition ' +
        'D DagumDistribution DamerauLevenshteinDistance DampingFactor Darker Dashed Dashing DataCompression DataDistribution DataRange DataReversed Date DateDelimiters DateDifference DateFunction DateList DateListLogPlot DateListPlot DatePattern DatePlus DateRange DateString DateTicksFormat DaubechiesWavelet DavisDistribution DawsonF DayCount DayCountConvention DayMatchQ DayName DayPlus DayRange DayRound DeBruijnGraph Debug DebugTag Decimal DeclareKnownSymbols DeclarePackage Decompose Decrement DedekindEta Default DefaultAxesStyle DefaultBaseStyle DefaultBoxStyle DefaultButton DefaultColor DefaultControlPlacement DefaultDuplicateCellStyle DefaultDuration DefaultElement DefaultFaceGridsStyle DefaultFieldHintStyle DefaultFont DefaultFontProperties DefaultFormatType DefaultFormatTypeForStyle DefaultFrameStyle DefaultFrameTicksStyle DefaultGridLinesStyle DefaultInlineFormatType DefaultInputFormatType DefaultLabelStyle DefaultMenuStyle DefaultNaturalLanguage DefaultNewCellStyle DefaultNewInlineCellStyle DefaultNotebook DefaultOptions DefaultOutputFormatType DefaultStyle DefaultStyleDefinitions DefaultTextFormatType DefaultTextInlineFormatType DefaultTicksStyle DefaultTooltipStyle DefaultValues Defer DefineExternal DefineInputStreamMethod DefineOutputStreamMethod Definition Degree DegreeCentrality DegreeGraphDistribution DegreeLexicographic DegreeReverseLexicographic Deinitialization Del Deletable Delete DeleteBorderComponents DeleteCases DeleteContents DeleteDirectory DeleteDuplicates DeleteFile DeleteSmallComponents DeleteWithContents DeletionWarning Delimiter DelimiterFlashTime DelimiterMatching Delimiters Denominator DensityGraphics DensityHistogram DensityPlot DependentVariables Deploy Deployed Depth DepthFirstScan Derivative DerivativeFilter DescriptorStateSpace DesignMatrix Det DGaussianWavelet DiacriticalPositioning Diagonal DiagonalMatrix Dialog DialogIndent DialogInput DialogLevel DialogNotebook DialogProlog DialogReturn DialogSymbols Diamond DiamondMatrix DiceDissimilarity DictionaryLookup DifferenceDelta DifferenceOrder DifferenceRoot DifferenceRootReduce Differences DifferentialD DifferentialRoot DifferentialRootReduce DifferentiatorFilter DigitBlock DigitBlockMinimum DigitCharacter DigitCount DigitQ DihedralGroup Dilation Dimensions DiracComb DiracDelta DirectedEdge DirectedEdges DirectedGraph DirectedGraphQ DirectedInfinity Direction Directive Directory DirectoryName DirectoryQ DirectoryStack DirichletCharacter DirichletConvolve DirichletDistribution DirichletL DirichletTransform DirichletWindow DisableConsolePrintPacket DiscreteChirpZTransform DiscreteConvolve DiscreteDelta DiscreteHadamardTransform DiscreteIndicator DiscreteLQEstimatorGains DiscreteLQRegulatorGains DiscreteLyapunovSolve DiscreteMarkovProcess DiscretePlot DiscretePlot3D DiscreteRatio DiscreteRiccatiSolve DiscreteShift DiscreteTimeModelQ DiscreteUniformDistribution DiscreteVariables DiscreteWaveletData DiscreteWaveletPacketTransform ' +
        'DiscreteWaveletTransform Discriminant Disjunction Disk DiskBox DiskMatrix Dispatch DispersionEstimatorFunction Display DisplayAllSteps DisplayEndPacket DisplayFlushImagePacket DisplayForm DisplayFunction DisplayPacket DisplayRules DisplaySetSizePacket DisplayString DisplayTemporary DisplayWith DisplayWithRef DisplayWithVariable DistanceFunction DistanceTransform Distribute Distributed DistributedContexts DistributeDefinitions DistributionChart DistributionDomain DistributionFitTest DistributionParameterAssumptions DistributionParameterQ Dithering Div Divergence Divide DivideBy Dividers Divisible Divisors DivisorSigma DivisorSum DMSList DMSString Do DockedCells DocumentNotebook DominantColors DOSTextFormat Dot DotDashed DotEqual Dotted DoubleBracketingBar DoubleContourIntegral DoubleDownArrow DoubleLeftArrow DoubleLeftRightArrow DoubleLeftTee DoubleLongLeftArrow DoubleLongLeftRightArrow DoubleLongRightArrow DoubleRightArrow DoubleRightTee DoubleUpArrow DoubleUpDownArrow DoubleVerticalBar DoublyInfinite Down DownArrow DownArrowBar DownArrowUpArrow DownLeftRightVector DownLeftTeeVector DownLeftVector DownLeftVectorBar DownRightTeeVector DownRightVector DownRightVectorBar Downsample DownTee DownTeeArrow DownValues DragAndDrop DrawEdges DrawFrontFaces DrawHighlighted Drop DSolve Dt DualLinearProgramming DualSystemsModel DumpGet DumpSave DuplicateFreeQ Dynamic DynamicBox DynamicBoxOptions DynamicEvaluationTimeout DynamicLocation DynamicModule DynamicModuleBox DynamicModuleBoxOptions DynamicModuleParent DynamicModuleValues DynamicName DynamicNamespace DynamicReference DynamicSetting DynamicUpdating DynamicWrapper DynamicWrapperBox DynamicWrapperBoxOptions ' +
        'E EccentricityCentrality EdgeAdd EdgeBetweennessCentrality EdgeCapacity EdgeCapForm EdgeColor EdgeConnectivity EdgeCost EdgeCount EdgeCoverQ EdgeDashing EdgeDelete EdgeDetect EdgeForm EdgeIndex EdgeJoinForm EdgeLabeling EdgeLabels EdgeLabelStyle EdgeList EdgeOpacity EdgeQ EdgeRenderingFunction EdgeRules EdgeShapeFunction EdgeStyle EdgeThickness EdgeWeight Editable EditButtonSettings EditCellTagsSettings EditDistance EffectiveInterest Eigensystem Eigenvalues EigenvectorCentrality Eigenvectors Element ElementData Eliminate EliminationOrder EllipticE EllipticExp EllipticExpPrime EllipticF EllipticFilterModel EllipticK EllipticLog EllipticNomeQ EllipticPi EllipticReducedHalfPeriods EllipticTheta EllipticThetaPrime EmitSound EmphasizeSyntaxErrors EmpiricalDistribution Empty EmptyGraphQ EnableConsolePrintPacket Enabled Encode End EndAdd EndDialogPacket EndFrontEndInteractionPacket EndOfFile EndOfLine EndOfString EndPackage EngineeringForm Enter EnterExpressionPacket EnterTextPacket Entropy EntropyFilter Environment Epilog Equal EqualColumns EqualRows EqualTilde EquatedTo Equilibrium EquirippleFilterKernel Equivalent Erf Erfc Erfi ErlangB ErlangC ErlangDistribution Erosion ErrorBox ErrorBoxOptions ErrorNorm ErrorPacket ErrorsDialogSettings EstimatedDistribution EstimatedProcess EstimatorGains EstimatorRegulator EuclideanDistance EulerE EulerGamma EulerianGraphQ EulerPhi Evaluatable Evaluate Evaluated EvaluatePacket EvaluationCell EvaluationCompletionAction EvaluationElements EvaluationMode EvaluationMonitor EvaluationNotebook EvaluationObject EvaluationOrder Evaluator EvaluatorNames EvenQ EventData EventEvaluator EventHandler EventHandlerTag EventLabels ExactBlackmanWindow ExactNumberQ ExactRootIsolation ExampleData Except ExcludedForms ExcludePods Exclusions ExclusionsStyle Exists Exit ExitDialog Exp Expand ExpandAll ExpandDenominator ExpandFileName ExpandNumerator Expectation ExpectationE ExpectedValue ExpGammaDistribution ExpIntegralE ExpIntegralEi Exponent ExponentFunction ExponentialDistribution ExponentialFamily ExponentialGeneratingFunction ExponentialMovingAverage ExponentialPowerDistribution ExponentPosition ExponentStep Export ExportAutoReplacements ExportPacket ExportString Expression ExpressionCell ExpressionPacket ExpToTrig ExtendedGCD Extension ExtentElementFunction ExtentMarkers ExtentSize ExternalCall ExternalDataCharacterEncoding Extract ExtractArchive ExtremeValueDistribution ' +
        'FaceForm FaceGrids FaceGridsStyle Factor FactorComplete Factorial Factorial2 FactorialMoment FactorialMomentGeneratingFunction FactorialPower FactorInteger FactorList FactorSquareFree FactorSquareFreeList FactorTerms FactorTermsList Fail FailureDistribution False FARIMAProcess FEDisableConsolePrintPacket FeedbackSector FeedbackSectorStyle FeedbackType FEEnableConsolePrintPacket Fibonacci FieldHint FieldHintStyle FieldMasked FieldSize File FileBaseName FileByteCount FileDate FileExistsQ FileExtension FileFormat FileHash FileInformation FileName FileNameDepth FileNameDialogSettings FileNameDrop FileNameJoin FileNames FileNameSetter FileNameSplit FileNameTake FilePrint FileType FilledCurve FilledCurveBox Filling FillingStyle FillingTransform FilterRules FinancialBond FinancialData FinancialDerivative FinancialIndicator Find FindArgMax FindArgMin FindClique FindClusters FindCurvePath FindDistributionParameters FindDivisions FindEdgeCover FindEdgeCut FindEulerianCycle FindFaces FindFile FindFit FindGeneratingFunction FindGeoLocation FindGeometricTransform FindGraphCommunities FindGraphIsomorphism FindGraphPartition FindHamiltonianCycle FindIndependentEdgeSet FindIndependentVertexSet FindInstance FindIntegerNullVector FindKClan FindKClique FindKClub FindKPlex FindLibrary FindLinearRecurrence FindList FindMaximum FindMaximumFlow FindMaxValue FindMinimum FindMinimumCostFlow FindMinimumCut FindMinValue FindPermutation FindPostmanTour FindProcessParameters FindRoot FindSequenceFunction FindSettings FindShortestPath FindShortestTour FindThreshold FindVertexCover FindVertexCut Fine FinishDynamic FiniteAbelianGroupCount FiniteGroupCount FiniteGroupData First FirstPassageTimeDistribution FischerGroupFi22 FischerGroupFi23 FischerGroupFi24Prime FisherHypergeometricDistribution FisherRatioTest FisherZDistribution Fit FitAll FittedModel FixedPoint FixedPointList FlashSelection Flat Flatten FlattenAt FlatTopWindow FlipView Floor FlushPrintOutputPacket Fold FoldList Font FontColor FontFamily FontForm FontName FontOpacity FontPostScriptName FontProperties FontReencoding FontSize FontSlant FontSubstitutions FontTracking FontVariations FontWeight For ForAll Format FormatRules FormatType FormatTypeAutoConvert FormatValues FormBox FormBoxOptions FortranForm Forward ForwardBackward Fourier FourierCoefficient FourierCosCoefficient FourierCosSeries FourierCosTransform FourierDCT FourierDCTFilter FourierDCTMatrix FourierDST FourierDSTMatrix FourierMatrix FourierParameters FourierSequenceTransform FourierSeries FourierSinCoefficient FourierSinSeries FourierSinTransform FourierTransform FourierTrigSeries FractionalBrownianMotionProcess FractionalPart FractionBox FractionBoxOptions FractionLine Frame FrameBox FrameBoxOptions Framed FrameInset FrameLabel Frameless FrameMargins FrameStyle FrameTicks FrameTicksStyle FRatioDistribution FrechetDistribution FreeQ FrequencySamplingFilterKernel FresnelC FresnelS Friday FrobeniusNumber FrobeniusSolve ' +
        'FromCharacterCode FromCoefficientRules FromContinuedFraction FromDate FromDigits FromDMS Front FrontEndDynamicExpression FrontEndEventActions FrontEndExecute FrontEndObject FrontEndResource FrontEndResourceString FrontEndStackSize FrontEndToken FrontEndTokenExecute FrontEndValueCache FrontEndVersion FrontFaceColor FrontFaceOpacity Full FullAxes FullDefinition FullForm FullGraphics FullOptions FullSimplify Function FunctionExpand FunctionInterpolation FunctionSpace FussellVeselyImportance ' +
        'GaborFilter GaborMatrix GaborWavelet GainMargins GainPhaseMargins Gamma GammaDistribution GammaRegularized GapPenalty Gather GatherBy GaugeFaceElementFunction GaugeFaceStyle GaugeFrameElementFunction GaugeFrameSize GaugeFrameStyle GaugeLabels GaugeMarkers GaugeStyle GaussianFilter GaussianIntegers GaussianMatrix GaussianWindow GCD GegenbauerC General GeneralizedLinearModelFit GenerateConditions GeneratedCell GeneratedParameters GeneratingFunction Generic GenericCylindricalDecomposition GenomeData GenomeLookup GeodesicClosing GeodesicDilation GeodesicErosion GeodesicOpening GeoDestination GeodesyData GeoDirection GeoDistance GeoGridPosition GeometricBrownianMotionProcess GeometricDistribution GeometricMean GeometricMeanFilter GeometricTransformation GeometricTransformation3DBox GeometricTransformation3DBoxOptions GeometricTransformationBox GeometricTransformationBoxOptions GeoPosition GeoPositionENU GeoPositionXYZ GeoProjectionData GestureHandler GestureHandlerTag Get GetBoundingBoxSizePacket GetContext GetEnvironment GetFileName GetFrontEndOptionsDataPacket GetLinebreakInformationPacket GetMenusPacket GetPageBreakInformationPacket Glaisher GlobalClusteringCoefficient GlobalPreferences GlobalSession Glow GoldenRatio GompertzMakehamDistribution GoodmanKruskalGamma GoodmanKruskalGammaTest Goto Grad Gradient GradientFilter GradientOrientationFilter Graph GraphAssortativity GraphCenter GraphComplement GraphData GraphDensity GraphDiameter GraphDifference GraphDisjointUnion ' +
        'GraphDistance GraphDistanceMatrix GraphElementData GraphEmbedding GraphHighlight GraphHighlightStyle GraphHub Graphics Graphics3D Graphics3DBox Graphics3DBoxOptions GraphicsArray GraphicsBaseline GraphicsBox GraphicsBoxOptions GraphicsColor GraphicsColumn GraphicsComplex GraphicsComplex3DBox GraphicsComplex3DBoxOptions GraphicsComplexBox GraphicsComplexBoxOptions GraphicsContents GraphicsData GraphicsGrid GraphicsGridBox GraphicsGroup GraphicsGroup3DBox GraphicsGroup3DBoxOptions GraphicsGroupBox GraphicsGroupBoxOptions GraphicsGrouping GraphicsHighlightColor GraphicsRow GraphicsSpacing GraphicsStyle GraphIntersection GraphLayout GraphLinkEfficiency GraphPeriphery GraphPlot GraphPlot3D GraphPower GraphPropertyDistribution GraphQ GraphRadius GraphReciprocity GraphRoot GraphStyle GraphUnion Gray GrayLevel GreatCircleDistance Greater GreaterEqual GreaterEqualLess GreaterFullEqual GreaterGreater GreaterLess GreaterSlantEqual GreaterTilde Green Grid GridBaseline GridBox GridBoxAlignment GridBoxBackground GridBoxDividers GridBoxFrame GridBoxItemSize GridBoxItemStyle GridBoxOptions GridBoxSpacings GridCreationSettings GridDefaultElement GridElementStyleOptions GridFrame GridFrameMargins GridGraph GridLines GridLinesStyle GroebnerBasis GroupActionBase GroupCentralizer GroupElementFromWord GroupElementPosition GroupElementQ GroupElements GroupElementToWord GroupGenerators GroupMultiplicationTable GroupOrbits GroupOrder GroupPageBreakWithin GroupSetwiseStabilizer GroupStabilizer GroupStabilizerChain Gudermannian GumbelDistribution ' +
        'HaarWavelet HadamardMatrix HalfNormalDistribution HamiltonianGraphQ HammingDistance HammingWindow HankelH1 HankelH2 HankelMatrix HannPoissonWindow HannWindow HaradaNortonGroupHN HararyGraph HarmonicMean HarmonicMeanFilter HarmonicNumber Hash HashTable Haversine HazardFunction Head HeadCompose Heads HeavisideLambda HeavisidePi HeavisideTheta HeldGroupHe HeldPart HelpBrowserLookup HelpBrowserNotebook HelpBrowserSettings HermiteDecomposition HermiteH HermitianMatrixQ HessenbergDecomposition Hessian HexadecimalCharacter Hexahedron HexahedronBox HexahedronBoxOptions HiddenSurface HighlightGraph HighlightImage HighpassFilter HigmanSimsGroupHS HilbertFilter HilbertMatrix Histogram Histogram3D HistogramDistribution HistogramList HistogramTransform HistogramTransformInterpolation HitMissTransform HITSCentrality HodgeDual HoeffdingD HoeffdingDTest Hold HoldAll HoldAllComplete HoldComplete HoldFirst HoldForm HoldPattern HoldRest HolidayCalendar HomeDirectory HomePage Horizontal HorizontalForm HorizontalGauge HorizontalScrollPosition HornerForm HotellingTSquareDistribution HoytDistribution HTMLSave Hue HumpDownHump HumpEqual HurwitzLerchPhi HurwitzZeta HyperbolicDistribution HypercubeGraph HyperexponentialDistribution Hyperfactorial Hypergeometric0F1 Hypergeometric0F1Regularized Hypergeometric1F1 Hypergeometric1F1Regularized Hypergeometric2F1 Hypergeometric2F1Regularized HypergeometricDistribution HypergeometricPFQ HypergeometricPFQRegularized HypergeometricU Hyperlink HyperlinkCreationSettings Hyphenation HyphenationOptions HypoexponentialDistribution HypothesisTestData ' +
        'I Identity IdentityMatrix If IgnoreCase Im Image Image3D Image3DSlices ImageAccumulate ImageAdd ImageAdjust ImageAlign ImageApply ImageAspectRatio ImageAssemble ImageCache ImageCacheValid ImageCapture ImageChannels ImageClip ImageColorSpace ImageCompose ImageConvolve ImageCooccurrence ImageCorners ImageCorrelate ImageCorrespondingPoints ImageCrop ImageData ImageDataPacket ImageDeconvolve ImageDemosaic ImageDifference ImageDimensions ImageDistance ImageEffect ImageFeatureTrack ImageFileApply ImageFileFilter ImageFileScan ImageFilter ImageForestingComponents ImageForwardTransformation ImageHistogram ImageKeypoints ImageLevels ImageLines ImageMargins ImageMarkers ImageMeasurements ImageMultiply ImageOffset ImagePad ImagePadding ImagePartition ImagePeriodogram ImagePerspectiveTransformation ImageQ ImageRangeCache ImageReflect ImageRegion ImageResize ImageResolution ImageRotate ImageRotated ImageScaled ImageScan ImageSize ImageSizeAction ImageSizeCache ImageSizeMultipliers ImageSizeRaw ImageSubtract ImageTake ImageTransformation ImageTrim ImageType ImageValue ImageValuePositions Implies Import ImportAutoReplacements ImportString ImprovementImportance In IncidenceGraph IncidenceList IncidenceMatrix IncludeConstantBasis IncludeFileExtension IncludePods IncludeSingularTerm Increment Indent IndentingNewlineSpacings IndentMaxFraction IndependenceTest IndependentEdgeSetQ IndependentUnit IndependentVertexSetQ Indeterminate IndexCreationOptions Indexed IndexGraph IndexTag Inequality InexactNumberQ InexactNumbers Infinity Infix Information Inherited InheritScope Initialization InitializationCell InitializationCellEvaluation InitializationCellWarning InlineCounterAssignments InlineCounterIncrements InlineRules Inner Inpaint Input InputAliases InputAssumptions InputAutoReplacements InputField InputFieldBox InputFieldBoxOptions InputForm InputGrouping InputNamePacket InputNotebook InputPacket InputSettings InputStream InputString InputStringPacket InputToBoxFormPacket Insert InsertionPointObject InsertResults Inset Inset3DBox Inset3DBoxOptions InsetBox InsetBoxOptions Install InstallService InString Integer IntegerDigits IntegerExponent IntegerLength IntegerPart IntegerPartitions IntegerQ Integers IntegerString Integral Integrate Interactive InteractiveTradingChart Interlaced Interleaving InternallyBalancedDecomposition InterpolatingFunction InterpolatingPolynomial Interpolation InterpolationOrder InterpolationPoints InterpolationPrecision Interpretation InterpretationBox InterpretationBoxOptions InterpretationFunction ' +
        'InterpretTemplate InterquartileRange Interrupt InterruptSettings Intersection Interval IntervalIntersection IntervalMemberQ IntervalUnion Inverse InverseBetaRegularized InverseCDF InverseChiSquareDistribution InverseContinuousWaveletTransform InverseDistanceTransform InverseEllipticNomeQ InverseErf InverseErfc InverseFourier InverseFourierCosTransform InverseFourierSequenceTransform InverseFourierSinTransform InverseFourierTransform InverseFunction InverseFunctions InverseGammaDistribution InverseGammaRegularized InverseGaussianDistribution InverseGudermannian InverseHaversine InverseJacobiCD InverseJacobiCN InverseJacobiCS InverseJacobiDC InverseJacobiDN InverseJacobiDS InverseJacobiNC InverseJacobiND InverseJacobiNS InverseJacobiSC InverseJacobiSD InverseJacobiSN InverseLaplaceTransform InversePermutation InverseRadon InverseSeries InverseSurvivalFunction InverseWaveletTransform InverseWeierstrassP InverseZTransform Invisible InvisibleApplication InvisibleTimes IrreduciblePolynomialQ IsolatingInterval IsomorphicGraphQ IsotopeData Italic Item ItemBox ItemBoxOptions ItemSize ItemStyle ItoProcess ' +
        'JaccardDissimilarity JacobiAmplitude Jacobian JacobiCD JacobiCN JacobiCS JacobiDC JacobiDN JacobiDS JacobiNC JacobiND JacobiNS JacobiP JacobiSC JacobiSD JacobiSN JacobiSymbol JacobiZeta JankoGroupJ1 JankoGroupJ2 JankoGroupJ3 JankoGroupJ4 JarqueBeraALMTest JohnsonDistribution Join Joined JoinedCurve JoinedCurveBox JoinForm JordanDecomposition JordanModelDecomposition ' +
        'K KagiChart KaiserBesselWindow KaiserWindow KalmanEstimator KalmanFilter KarhunenLoeveDecomposition KaryTree KatzCentrality KCoreComponents KDistribution KelvinBei KelvinBer KelvinKei KelvinKer KendallTau KendallTauTest KernelExecute KernelMixtureDistribution KernelObject Kernels Ket Khinchin KirchhoffGraph KirchhoffMatrix KleinInvariantJ KnightTourGraph KnotData KnownUnitQ KolmogorovSmirnovTest KroneckerDelta KroneckerModelDecomposition KroneckerProduct KroneckerSymbol KuiperTest KumaraswamyDistribution Kurtosis KuwaharaFilter ' +
        'Label Labeled LabeledSlider LabelingFunction LabelStyle LaguerreL LambdaComponents LambertW LanczosWindow LandauDistribution Language LanguageCategory LaplaceDistribution LaplaceTransform Laplacian LaplacianFilter LaplacianGaussianFilter Large Larger Last Latitude LatitudeLongitude LatticeData LatticeReduce Launch LaunchKernels LayeredGraphPlot LayerSizeFunction LayoutInformation LCM LeafCount LeapYearQ LeastSquares LeastSquaresFilterKernel Left LeftArrow LeftArrowBar LeftArrowRightArrow LeftDownTeeVector LeftDownVector LeftDownVectorBar LeftRightArrow LeftRightVector LeftTee LeftTeeArrow LeftTeeVector LeftTriangle LeftTriangleBar LeftTriangleEqual LeftUpDownVector LeftUpTeeVector LeftUpVector LeftUpVectorBar LeftVector LeftVectorBar LegendAppearance Legended LegendFunction LegendLabel LegendLayout LegendMargins LegendMarkers LegendMarkerSize LegendreP LegendreQ LegendreType Length LengthWhile LerchPhi Less LessEqual LessEqualGreater LessFullEqual LessGreater LessLess LessSlantEqual LessTilde LetterCharacter LetterQ Level LeveneTest LeviCivitaTensor LevyDistribution Lexicographic LibraryFunction LibraryFunctionError LibraryFunctionInformation LibraryFunctionLoad LibraryFunctionUnload LibraryLoad LibraryUnload LicenseID LiftingFilterData LiftingWaveletTransform LightBlue LightBrown LightCyan Lighter LightGray LightGreen Lighting LightingAngle LightMagenta LightOrange LightPink LightPurple LightRed LightSources LightYellow Likelihood Limit LimitsPositioning LimitsPositioningTokens LindleyDistribution Line Line3DBox LinearFilter LinearFractionalTransform LinearModelFit LinearOffsetFunction LinearProgramming LinearRecurrence LinearSolve LinearSolveFunction LineBox LineBreak LinebreakAdjustments LineBreakChart LineBreakWithin LineColor LineForm LineGraph LineIndent LineIndentMaxFraction LineIntegralConvolutionPlot LineIntegralConvolutionScale LineLegend LineOpacity LineSpacing LineWrapParts LinkActivate LinkClose LinkConnect LinkConnectedQ LinkCreate LinkError LinkFlush LinkFunction LinkHost LinkInterrupt LinkLaunch LinkMode LinkObject LinkOpen LinkOptions LinkPatterns LinkProtocol LinkRead LinkReadHeld LinkReadyQ Links LinkWrite LinkWriteHeld LiouvilleLambda List Listable ListAnimate ListContourPlot ListContourPlot3D ListConvolve ListCorrelate ListCurvePathPlot ListDeconvolve ListDensityPlot Listen ListFourierSequenceTransform ListInterpolation ListLineIntegralConvolutionPlot ListLinePlot ListLogLinearPlot ListLogLogPlot ListLogPlot ListPicker ListPickerBox ListPickerBoxBackground ListPickerBoxOptions ListPlay ListPlot ListPlot3D ListPointPlot3D ListPolarPlot ListQ ListStreamDensityPlot ListStreamPlot ListSurfacePlot3D ListVectorDensityPlot ListVectorPlot ListVectorPlot3D ListZTransform Literal LiteralSearch LocalClusteringCoefficient LocalizeVariables LocationEquivalenceTest LocationTest Locator LocatorAutoCreate LocatorBox LocatorBoxOptions LocatorCentering LocatorPane LocatorPaneBox LocatorPaneBoxOptions ' +
        'LocatorRegion Locked Log Log10 Log2 LogBarnesG LogGamma LogGammaDistribution LogicalExpand LogIntegral LogisticDistribution LogitModelFit LogLikelihood LogLinearPlot LogLogisticDistribution LogLogPlot LogMultinormalDistribution LogNormalDistribution LogPlot LogRankTest LogSeriesDistribution LongEqual Longest LongestAscendingSequence LongestCommonSequence LongestCommonSequencePositions LongestCommonSubsequence LongestCommonSubsequencePositions LongestMatch LongForm Longitude LongLeftArrow LongLeftRightArrow LongRightArrow Loopback LoopFreeGraphQ LowerCaseQ LowerLeftArrow LowerRightArrow LowerTriangularize LowpassFilter LQEstimatorGains LQGRegulator LQOutputRegulatorGains LQRegulatorGains LUBackSubstitution LucasL LuccioSamiComponents LUDecomposition LyapunovSolve LyonsGroupLy ' +
        'MachineID MachineName MachineNumberQ MachinePrecision MacintoshSystemPageSetup Magenta Magnification Magnify MainSolve MaintainDynamicCaches Majority MakeBoxes MakeExpression MakeRules MangoldtLambda ManhattanDistance Manipulate Manipulator MannWhitneyTest MantissaExponent Manual Map MapAll MapAt MapIndexed MAProcess MapThread MarcumQ MardiaCombinedTest MardiaKurtosisTest MardiaSkewnessTest MarginalDistribution MarkovProcessProperties Masking MatchingDissimilarity MatchLocalNameQ MatchLocalNames MatchQ Material MathematicaNotation MathieuC MathieuCharacteristicA MathieuCharacteristicB MathieuCharacteristicExponent MathieuCPrime MathieuGroupM11 MathieuGroupM12 MathieuGroupM22 MathieuGroupM23 MathieuGroupM24 MathieuS MathieuSPrime MathMLForm MathMLText Matrices MatrixExp MatrixForm MatrixFunction MatrixLog MatrixPlot MatrixPower MatrixQ MatrixRank Max MaxBend MaxDetect MaxExtraBandwidths MaxExtraConditions MaxFeatures MaxFilter Maximize MaxIterations MaxMemoryUsed MaxMixtureKernels MaxPlotPoints MaxPoints MaxRecursion MaxStableDistribution MaxStepFraction MaxSteps MaxStepSize MaxValue MaxwellDistribution McLaughlinGroupMcL Mean MeanClusteringCoefficient MeanDegreeConnectivity MeanDeviation MeanFilter MeanGraphDistance MeanNeighborDegree MeanShift MeanShiftFilter Median MedianDeviation MedianFilter Medium MeijerG MeixnerDistribution MemberQ MemoryConstrained MemoryInUse Menu MenuAppearance MenuCommandKey MenuEvaluator MenuItem MenuPacket MenuSortingValue MenuStyle MenuView MergeDifferences Mesh MeshFunctions MeshRange MeshShading MeshStyle Message MessageDialog MessageList MessageName MessageOptions MessagePacket Messages MessagesNotebook MetaCharacters MetaInformation Method MethodOptions MexicanHatWavelet MeyerWavelet Min MinDetect MinFilter MinimalPolynomial MinimalStateSpaceModel Minimize Minors MinRecursion MinSize MinStableDistribution Minus MinusPlus MinValue Missing MissingDataMethod MittagLefflerE MixedRadix MixedRadixQuantity MixtureDistribution Mod Modal Mode Modular ModularLambda Module Modulus MoebiusMu Moment Momentary MomentConvert MomentEvaluate MomentGeneratingFunction Monday Monitor MonomialList MonomialOrder MonsterGroupM MorletWavelet MorphologicalBinarize MorphologicalBranchPoints MorphologicalComponents MorphologicalEulerNumber MorphologicalGraph MorphologicalPerimeter MorphologicalTransform Most MouseAnnotation MouseAppearance MouseAppearanceTag MouseButtons Mouseover MousePointerNote MousePosition MovingAverage MovingMedian MoyalDistribution MultiedgeStyle MultilaunchWarning MultiLetterItalics MultiLetterStyle MultilineFunction Multinomial MultinomialDistribution MultinormalDistribution MultiplicativeOrder Multiplicity Multiselection MultivariateHypergeometricDistribution MultivariatePoissonDistribution MultivariateTDistribution ' +
        'N NakagamiDistribution NameQ Names NamespaceBox Nand NArgMax NArgMin NBernoulliB NCache NDSolve NDSolveValue Nearest NearestFunction NeedCurrentFrontEndPackagePacket NeedCurrentFrontEndSymbolsPacket NeedlemanWunschSimilarity Needs Negative NegativeBinomialDistribution NegativeMultinomialDistribution NeighborhoodGraph Nest NestedGreaterGreater NestedLessLess NestedScriptRules NestList NestWhile NestWhileList NevilleThetaC NevilleThetaD NevilleThetaN NevilleThetaS NewPrimitiveStyle NExpectation Next NextPrime NHoldAll NHoldFirst NHoldRest NicholsGridLines NicholsPlot NIntegrate NMaximize NMaxValue NMinimize NMinValue NominalVariables NonAssociative NoncentralBetaDistribution NoncentralChiSquareDistribution NoncentralFRatioDistribution NoncentralStudentTDistribution NonCommutativeMultiply NonConstants None NonlinearModelFit NonlocalMeansFilter NonNegative NonPositive Nor NorlundB Norm Normal NormalDistribution NormalGrouping Normalize NormalizedSquaredEuclideanDistance NormalsFunction NormFunction Not NotCongruent NotCupCap NotDoubleVerticalBar Notebook NotebookApply NotebookAutoSave NotebookClose NotebookConvertSettings NotebookCreate NotebookCreateReturnObject NotebookDefault NotebookDelete NotebookDirectory NotebookDynamicExpression NotebookEvaluate NotebookEventActions NotebookFileName NotebookFind NotebookFindReturnObject NotebookGet NotebookGetLayoutInformationPacket NotebookGetMisspellingsPacket NotebookInformation NotebookInterfaceObject NotebookLocate NotebookObject NotebookOpen NotebookOpenReturnObject NotebookPath NotebookPrint NotebookPut NotebookPutReturnObject NotebookRead NotebookResetGeneratedCells Notebooks NotebookSave NotebookSaveAs NotebookSelection NotebookSetupLayoutInformationPacket NotebooksMenu NotebookWrite NotElement NotEqualTilde NotExists NotGreater NotGreaterEqual NotGreaterFullEqual NotGreaterGreater NotGreaterLess NotGreaterSlantEqual NotGreaterTilde NotHumpDownHump NotHumpEqual NotLeftTriangle NotLeftTriangleBar NotLeftTriangleEqual NotLess NotLessEqual NotLessFullEqual NotLessGreater NotLessLess NotLessSlantEqual NotLessTilde NotNestedGreaterGreater NotNestedLessLess NotPrecedes NotPrecedesEqual NotPrecedesSlantEqual NotPrecedesTilde NotReverseElement NotRightTriangle NotRightTriangleBar NotRightTriangleEqual NotSquareSubset NotSquareSubsetEqual NotSquareSuperset NotSquareSupersetEqual NotSubset NotSubsetEqual NotSucceeds NotSucceedsEqual NotSucceedsSlantEqual NotSucceedsTilde NotSuperset NotSupersetEqual NotTilde NotTildeEqual NotTildeFullEqual NotTildeTilde NotVerticalBar NProbability NProduct NProductFactors NRoots NSolve NSum NSumTerms Null NullRecords NullSpace NullWords Number NumberFieldClassNumber NumberFieldDiscriminant NumberFieldFundamentalUnits NumberFieldIntegralBasis NumberFieldNormRepresentatives NumberFieldRegulator NumberFieldRootsOfUnity NumberFieldSignature NumberForm NumberFormat NumberMarks NumberMultiplier NumberPadding NumberPoint NumberQ NumberSeparator ' +
        'NumberSigns NumberString Numerator NumericFunction NumericQ NuttallWindow NValues NyquistGridLines NyquistPlot ' +
        'O ObservabilityGramian ObservabilityMatrix ObservableDecomposition ObservableModelQ OddQ Off Offset OLEData On ONanGroupON OneIdentity Opacity Open OpenAppend Opener OpenerBox OpenerBoxOptions OpenerView OpenFunctionInspectorPacket Opening OpenRead OpenSpecialOptions OpenTemporary OpenWrite Operate OperatingSystem OptimumFlowData Optional OptionInspectorSettings OptionQ Options OptionsPacket OptionsPattern OptionValue OptionValueBox OptionValueBoxOptions Or Orange Order OrderDistribution OrderedQ Ordering Orderless OrnsteinUhlenbeckProcess Orthogonalize Out Outer OutputAutoOverwrite OutputControllabilityMatrix OutputControllableModelQ OutputForm OutputFormData OutputGrouping OutputMathEditExpression OutputNamePacket OutputResponse OutputSizeLimit OutputStream Over OverBar OverDot Overflow OverHat Overlaps Overlay OverlayBox OverlayBoxOptions Overscript OverscriptBox OverscriptBoxOptions OverTilde OverVector OwenT OwnValues ' +
        'PackingMethod PaddedForm Padding PadeApproximant PadLeft PadRight PageBreakAbove PageBreakBelow PageBreakWithin PageFooterLines PageFooters PageHeaderLines PageHeaders PageHeight PageRankCentrality PageWidth PairedBarChart PairedHistogram PairedSmoothHistogram PairedTTest PairedZTest PaletteNotebook PalettePath Pane PaneBox PaneBoxOptions Panel PanelBox PanelBoxOptions Paneled PaneSelector PaneSelectorBox PaneSelectorBoxOptions PaperWidth ParabolicCylinderD ParagraphIndent ParagraphSpacing ParallelArray ParallelCombine ParallelDo ParallelEvaluate Parallelization Parallelize ParallelMap ParallelNeeds ParallelProduct ParallelSubmit ParallelSum ParallelTable ParallelTry Parameter ParameterEstimator ParameterMixtureDistribution ParameterVariables ParametricFunction ParametricNDSolve ParametricNDSolveValue ParametricPlot ParametricPlot3D ParentConnect ParentDirectory ParentForm Parenthesize ParentList ParetoDistribution Part PartialCorrelationFunction PartialD ParticleData Partition PartitionsP PartitionsQ ParzenWindow PascalDistribution PassEventsDown PassEventsUp Paste PasteBoxFormInlineCells PasteButton Path PathGraph PathGraphQ Pattern PatternSequence PatternTest PauliMatrix PaulWavelet Pause PausedTime PDF PearsonChiSquareTest PearsonCorrelationTest PearsonDistribution PerformanceGoal PeriodicInterpolation Periodogram PeriodogramArray PermutationCycles PermutationCyclesQ PermutationGroup PermutationLength PermutationList PermutationListQ PermutationMax PermutationMin PermutationOrder PermutationPower PermutationProduct PermutationReplace Permutations PermutationSupport Permute PeronaMalikFilter Perpendicular PERTDistribution PetersenGraph PhaseMargins Pi Pick PIDData PIDDerivativeFilter PIDFeedforward PIDTune Piecewise PiecewiseExpand PieChart PieChart3D PillaiTrace PillaiTraceTest Pink Pivoting PixelConstrained PixelValue PixelValuePositions Placed Placeholder PlaceholderReplace Plain PlanarGraphQ Play PlayRange Plot Plot3D Plot3Matrix PlotDivision PlotJoined PlotLabel PlotLayout PlotLegends PlotMarkers PlotPoints PlotRange PlotRangeClipping PlotRangePadding PlotRegion PlotStyle Plus PlusMinus Pochhammer PodStates PodWidth Point Point3DBox PointBox PointFigureChart PointForm PointLegend PointSize PoissonConsulDistribution PoissonDistribution PoissonProcess PoissonWindow PolarAxes PolarAxesOrigin PolarGridLines PolarPlot PolarTicks PoleZeroMarkers PolyaAeppliDistribution PolyGamma Polygon Polygon3DBox Polygon3DBoxOptions PolygonBox PolygonBoxOptions PolygonHoleScale PolygonIntersections PolygonScale PolyhedronData PolyLog PolynomialExtendedGCD PolynomialForm PolynomialGCD PolynomialLCM PolynomialMod PolynomialQ PolynomialQuotient PolynomialQuotientRemainder PolynomialReduce PolynomialRemainder Polynomials PopupMenu PopupMenuBox PopupMenuBoxOptions PopupView PopupWindow Position Positive PositiveDefiniteMatrixQ PossibleZeroQ Postfix PostScript Power PowerDistribution PowerExpand PowerMod PowerModList ' +
        'PowerSpectralDensity PowersRepresentations PowerSymmetricPolynomial Precedence PrecedenceForm Precedes PrecedesEqual PrecedesSlantEqual PrecedesTilde Precision PrecisionGoal PreDecrement PredictionRoot PreemptProtect PreferencesPath Prefix PreIncrement Prepend PrependTo PreserveImageOptions Previous PriceGraphDistribution PrimaryPlaceholder Prime PrimeNu PrimeOmega PrimePi PrimePowerQ PrimeQ Primes PrimeZetaP PrimitiveRoot PrincipalComponents PrincipalValue Print PrintAction PrintForm PrintingCopies PrintingOptions PrintingPageRange PrintingStartingPageNumber PrintingStyleEnvironment PrintPrecision PrintTemporary Prism PrismBox PrismBoxOptions PrivateCellOptions PrivateEvaluationOptions PrivateFontOptions PrivateFrontEndOptions PrivateNotebookOptions PrivatePaths Probability ProbabilityDistribution ProbabilityPlot ProbabilityPr ProbabilityScalePlot ProbitModelFit ProcessEstimator ProcessParameterAssumptions ProcessParameterQ ProcessStateDomain ProcessTimeDomain Product ProductDistribution ProductLog ProgressIndicator ProgressIndicatorBox ProgressIndicatorBoxOptions Projection Prolog PromptForm Properties Property PropertyList PropertyValue Proportion Proportional Protect Protected ProteinData Pruning PseudoInverse Purple Put PutAppend Pyramid PyramidBox PyramidBoxOptions ' +
        'QBinomial QFactorial QGamma QHypergeometricPFQ QPochhammer QPolyGamma QRDecomposition QuadraticIrrationalQ Quantile QuantilePlot Quantity QuantityForm QuantityMagnitude QuantityQ QuantityUnit Quartics QuartileDeviation Quartiles QuartileSkewness QueueingNetworkProcess QueueingProcess QueueProperties Quiet Quit Quotient QuotientRemainder ' +
        'RadialityCentrality RadicalBox RadicalBoxOptions RadioButton RadioButtonBar RadioButtonBox RadioButtonBoxOptions Radon RamanujanTau RamanujanTauL RamanujanTauTheta RamanujanTauZ Random RandomChoice RandomComplex RandomFunction RandomGraph RandomImage RandomInteger RandomPermutation RandomPrime RandomReal RandomSample RandomSeed RandomVariate RandomWalkProcess Range RangeFilter RangeSpecification RankedMax RankedMin Raster Raster3D Raster3DBox Raster3DBoxOptions RasterArray RasterBox RasterBoxOptions Rasterize RasterSize Rational RationalFunctions Rationalize Rationals Ratios Raw RawArray RawBoxes RawData RawMedium RayleighDistribution Re Read ReadList ReadProtected Real RealBlockDiagonalForm RealDigits RealExponent Reals Reap Record RecordLists RecordSeparators Rectangle RectangleBox RectangleBoxOptions RectangleChart RectangleChart3D RecurrenceFilter RecurrenceTable RecurringDigitsForm Red Reduce RefBox ReferenceLineStyle ReferenceMarkers ReferenceMarkerStyle Refine ReflectionMatrix ReflectionTransform Refresh RefreshRate RegionBinarize RegionFunction RegionPlot RegionPlot3D RegularExpression Regularization Reinstall Release ReleaseHold ReliabilityDistribution ReliefImage ReliefPlot Remove RemoveAlphaChannel RemoveAsynchronousTask Removed RemoveInputStreamMethod RemoveOutputStreamMethod RemoveProperty RemoveScheduledTask RenameDirectory RenameFile RenderAll RenderingOptions RenewalProcess RenkoChart Repeated RepeatedNull RepeatedString Replace ReplaceAll ReplaceHeldPart ReplaceImageValue ReplaceList ReplacePart ReplacePixelValue ReplaceRepeated Resampling Rescale RescalingTransform ResetDirectory ResetMenusPacket ResetScheduledTask Residue Resolve Rest Resultant ResumePacket Return ReturnExpressionPacket ReturnInputFormPacket ReturnPacket ReturnTextPacket Reverse ReverseBiorthogonalSplineWavelet ReverseElement ReverseEquilibrium ReverseGraph ReverseUpEquilibrium RevolutionAxis RevolutionPlot3D RGBColor RiccatiSolve RiceDistribution RidgeFilter RiemannR RiemannSiegelTheta RiemannSiegelZ Riffle Right RightArrow RightArrowBar RightArrowLeftArrow RightCosetRepresentative RightDownTeeVector RightDownVector RightDownVectorBar RightTee RightTeeArrow RightTeeVector RightTriangle RightTriangleBar RightTriangleEqual RightUpDownVector RightUpTeeVector RightUpVector RightUpVectorBar RightVector RightVectorBar RiskAchievementImportance RiskReductionImportance RogersTanimotoDissimilarity Root RootApproximant RootIntervals RootLocusPlot RootMeanSquare RootOfUnityQ RootReduce Roots RootSum Rotate RotateLabel RotateLeft RotateRight RotationAction RotationBox RotationBoxOptions RotationMatrix RotationTransform Round RoundImplies RoundingRadius Row RowAlignments RowBackgrounds RowBox RowHeights RowLines RowMinHeight RowReduce RowsEqual RowSpacings RSolve RudvalisGroupRu Rule RuleCondition RuleDelayed RuleForm RulerUnits Run RunScheduledTask RunThrough RuntimeAttributes RuntimeOptions RussellRaoDissimilarity ' +
        'SameQ SameTest SampleDepth SampledSoundFunction SampledSoundList SampleRate SamplingPeriod SARIMAProcess SARMAProcess SatisfiabilityCount SatisfiabilityInstances SatisfiableQ Saturday Save Saveable SaveAutoDelete SaveDefinitions SawtoothWave Scale Scaled ScaleDivisions ScaledMousePosition ScaleOrigin ScalePadding ScaleRanges ScaleRangeStyle ScalingFunctions ScalingMatrix ScalingTransform Scan ScheduledTaskActiveQ ScheduledTaskData ScheduledTaskObject ScheduledTasks SchurDecomposition ScientificForm ScreenRectangle ScreenStyleEnvironment ScriptBaselineShifts ScriptLevel ScriptMinSize ScriptRules ScriptSizeMultipliers Scrollbars ScrollingOptions ScrollPosition Sec Sech SechDistribution SectionGrouping SectorChart SectorChart3D SectorOrigin SectorSpacing SeedRandom Select Selectable SelectComponents SelectedCells SelectedNotebook Selection SelectionAnimate SelectionCell SelectionCellCreateCell SelectionCellDefaultStyle SelectionCellParentStyle SelectionCreateCell SelectionDebuggerTag SelectionDuplicateCell SelectionEvaluate SelectionEvaluateCreateCell SelectionMove SelectionPlaceholder SelectionSetStyle SelectWithContents SelfLoops SelfLoopStyle SemialgebraicComponentInstances SendMail Sequence SequenceAlignment SequenceForm SequenceHold SequenceLimit Series SeriesCoefficient SeriesData SessionTime Set SetAccuracy SetAlphaChannel SetAttributes Setbacks SetBoxFormNamesPacket SetDelayed SetDirectory SetEnvironment SetEvaluationNotebook SetFileDate SetFileLoadingContext SetNotebookStatusLine SetOptions SetOptionsPacket SetPrecision SetProperty SetSelectedNotebook SetSharedFunction SetSharedVariable SetSpeechParametersPacket SetStreamPosition SetSystemOptions Setter SetterBar SetterBox SetterBoxOptions Setting SetValue Shading Shallow ShannonWavelet ShapiroWilkTest Share Sharpen ShearingMatrix ShearingTransform ShenCastanMatrix Short ShortDownArrow Shortest ShortestMatch ShortestPathFunction ShortLeftArrow ShortRightArrow ShortUpArrow Show ShowAutoStyles ShowCellBracket ShowCellLabel ShowCellTags ShowClosedCellArea ShowContents ShowControls ShowCursorTracker ShowGroupOpenCloseIcon ShowGroupOpener ShowInvisibleCharacters ShowPageBreaks ShowPredictiveInterface ShowSelection ShowShortBoxForm ShowSpecialCharacters ShowStringCharacters ShowSyntaxStyles ShrinkingDelay ShrinkWrapBoundingBox SiegelTheta SiegelTukeyTest Sign Signature SignedRankTest SignificanceLevel SignPadding SignTest SimilarityRules SimpleGraph SimpleGraphQ Simplify Sin Sinc SinghMaddalaDistribution SingleEvaluation SingleLetterItalics SingleLetterStyle SingularValueDecomposition SingularValueList SingularValuePlot SingularValues Sinh SinhIntegral SinIntegral SixJSymbol Skeleton SkeletonTransform SkellamDistribution Skewness SkewNormalDistribution Skip SliceDistribution Slider Slider2D Slider2DBox Slider2DBoxOptions SliderBox SliderBoxOptions SlideView Slot SlotSequence Small SmallCircle Smaller SmithDelayCompensator SmithWatermanSimilarity ' +
        'SmoothDensityHistogram SmoothHistogram SmoothHistogram3D SmoothKernelDistribution SocialMediaData Socket SokalSneathDissimilarity Solve SolveAlways SolveDelayed Sort SortBy Sound SoundAndGraphics SoundNote SoundVolume Sow Space SpaceForm Spacer Spacings Span SpanAdjustments SpanCharacterRounding SpanFromAbove SpanFromBoth SpanFromLeft SpanLineThickness SpanMaxSize SpanMinSize SpanningCharacters SpanSymmetric SparseArray SpatialGraphDistribution Speak SpeakTextPacket SpearmanRankTest SpearmanRho Spectrogram SpectrogramArray Specularity SpellingCorrection SpellingDictionaries SpellingDictionariesPath SpellingOptions SpellingSuggestionsPacket Sphere SphereBox SphericalBesselJ SphericalBesselY SphericalHankelH1 SphericalHankelH2 SphericalHarmonicY SphericalPlot3D SphericalRegion SpheroidalEigenvalue SpheroidalJoiningFactor SpheroidalPS SpheroidalPSPrime SpheroidalQS SpheroidalQSPrime SpheroidalRadialFactor SpheroidalS1 SpheroidalS1Prime SpheroidalS2 SpheroidalS2Prime Splice SplicedDistribution SplineClosed SplineDegree SplineKnots SplineWeights Split SplitBy SpokenString Sqrt SqrtBox SqrtBoxOptions Square SquaredEuclideanDistance SquareFreeQ SquareIntersection SquaresR SquareSubset SquareSubsetEqual SquareSuperset SquareSupersetEqual SquareUnion SquareWave StabilityMargins StabilityMarginsStyle StableDistribution Stack StackBegin StackComplete StackInhibit StandardDeviation StandardDeviationFilter StandardForm Standardize StandbyDistribution Star StarGraph StartAsynchronousTask StartingStepSize StartOfLine StartOfString StartScheduledTask StartupSound StateDimensions StateFeedbackGains StateOutputEstimator StateResponse StateSpaceModel StateSpaceRealization StateSpaceTransform StationaryDistribution StationaryWaveletPacketTransform StationaryWaveletTransform StatusArea StatusCentrality StepMonitor StieltjesGamma StirlingS1 StirlingS2 StopAsynchronousTask StopScheduledTask StrataVariables StratonovichProcess StreamColorFunction StreamColorFunctionScaling StreamDensityPlot StreamPlot StreamPoints StreamPosition Streams StreamScale StreamStyle String StringBreak StringByteCount StringCases StringCount StringDrop StringExpression StringForm StringFormat StringFreeQ StringInsert StringJoin StringLength StringMatchQ StringPosition StringQ StringReplace StringReplaceList StringReplacePart StringReverse StringRotateLeft StringRotateRight StringSkeleton StringSplit StringTake StringToStream StringTrim StripBoxes StripOnInput StripWrapperBoxes StrokeForm StructuralImportance StructuredArray StructuredSelection StruveH StruveL Stub StudentTDistribution Style StyleBox StyleBoxAutoDelete StyleBoxOptions StyleData StyleDefinitions StyleForm StyleKeyMapping StyleMenuListing StyleNameDialogSettings StyleNames StylePrint StyleSheetPath Subfactorial Subgraph SubMinus SubPlus SubresultantPolynomialRemainders ' +
        'SubresultantPolynomials Subresultants Subscript SubscriptBox SubscriptBoxOptions Subscripted Subset SubsetEqual Subsets SubStar Subsuperscript SubsuperscriptBox SubsuperscriptBoxOptions Subtract SubtractFrom SubValues Succeeds SucceedsEqual SucceedsSlantEqual SucceedsTilde SuchThat Sum SumConvergence Sunday SuperDagger SuperMinus SuperPlus Superscript SuperscriptBox SuperscriptBoxOptions Superset SupersetEqual SuperStar Surd SurdForm SurfaceColor SurfaceGraphics SurvivalDistribution SurvivalFunction SurvivalModel SurvivalModelFit SuspendPacket SuzukiDistribution SuzukiGroupSuz SwatchLegend Switch Symbol SymbolName SymletWavelet Symmetric SymmetricGroup SymmetricMatrixQ SymmetricPolynomial SymmetricReduction Symmetrize SymmetrizedArray SymmetrizedArrayRules SymmetrizedDependentComponents SymmetrizedIndependentComponents SymmetrizedReplacePart SynchronousInitialization SynchronousUpdating Syntax SyntaxForm SyntaxInformation SyntaxLength SyntaxPacket SyntaxQ SystemDialogInput SystemException SystemHelpPath SystemInformation SystemInformationData SystemOpen SystemOptions SystemsModelDelay SystemsModelDelayApproximate SystemsModelDelete SystemsModelDimensions SystemsModelExtract SystemsModelFeedbackConnect SystemsModelLabels SystemsModelOrder SystemsModelParallelConnect SystemsModelSeriesConnect SystemsModelStateFeedbackConnect SystemStub ' +
        'Tab TabFilling Table TableAlignments TableDepth TableDirections TableForm TableHeadings TableSpacing TableView TableViewBox TabSpacings TabView TabViewBox TabViewBoxOptions TagBox TagBoxNote TagBoxOptions TaggingRules TagSet TagSetDelayed TagStyle TagUnset Take TakeWhile Tally Tan Tanh TargetFunctions TargetUnits TautologyQ TelegraphProcess TemplateBox TemplateBoxOptions TemplateSlotSequence TemporalData Temporary TemporaryVariable TensorContract TensorDimensions TensorExpand TensorProduct TensorQ TensorRank TensorReduce TensorSymmetry TensorTranspose TensorWedge Tetrahedron TetrahedronBox TetrahedronBoxOptions TeXForm TeXSave Text Text3DBox Text3DBoxOptions TextAlignment TextBand TextBoundingBox TextBox TextCell TextClipboardType TextData TextForm TextJustification TextLine TextPacket TextParagraph TextRecognize TextRendering TextStyle Texture TextureCoordinateFunction TextureCoordinateScaling Therefore ThermometerGauge Thick Thickness Thin Thinning ThisLink ThompsonGroupTh Thread ThreeJSymbol Threshold Through Throw Thumbnail Thursday Ticks TicksStyle Tilde TildeEqual TildeFullEqual TildeTilde TimeConstrained TimeConstraint Times TimesBy TimeSeriesForecast TimeSeriesInvertibility TimeUsed TimeValue TimeZone Timing Tiny TitleGrouping TitsGroupT ToBoxes ToCharacterCode ToColor ToContinuousTimeModel ToDate ToDiscreteTimeModel ToeplitzMatrix ToExpression ToFileName Together Toggle ToggleFalse Toggler TogglerBar TogglerBox TogglerBoxOptions ToHeldExpression ToInvertibleTimeSeries TokenWords Tolerance ToLowerCase ToNumberField TooBig Tooltip TooltipBox TooltipBoxOptions TooltipDelay TooltipStyle Top TopHatTransform TopologicalSort ToRadicals ToRules ToString Total TotalHeight TotalVariationFilter TotalWidth TouchscreenAutoZoom TouchscreenControlPlacement ToUpperCase Tr Trace TraceAbove TraceAction TraceBackward TraceDepth TraceDialog TraceForward TraceInternal TraceLevel TraceOff TraceOn TraceOriginal TracePrint TraceScan TrackedSymbols TradingChart TraditionalForm TraditionalFunctionNotation TraditionalNotation TraditionalOrder TransferFunctionCancel TransferFunctionExpand TransferFunctionFactor TransferFunctionModel TransferFunctionPoles TransferFunctionTransform TransferFunctionZeros TransformationFunction TransformationFunctions TransformationMatrix TransformedDistribution TransformedField Translate TranslationTransform TransparentColor Transpose TreeForm TreeGraph TreeGraphQ TreePlot TrendStyle TriangleWave TriangularDistribution Trig TrigExpand TrigFactor TrigFactorList Trigger TrigReduce TrigToExp TrimmedMean True TrueQ TruncatedDistribution TsallisQExponentialDistribution TsallisQGaussianDistribution TTest Tube TubeBezierCurveBox TubeBezierCurveBoxOptions TubeBox TubeBSplineCurveBox TubeBSplineCurveBoxOptions Tuesday TukeyLambdaDistribution TukeyWindow Tuples TuranGraph TuringMachine ' +
        'Transparent ' +
        'UnateQ Uncompress Undefined UnderBar Underflow Underlined Underoverscript UnderoverscriptBox UnderoverscriptBoxOptions Underscript UnderscriptBox UnderscriptBoxOptions UndirectedEdge UndirectedGraph UndirectedGraphQ UndocumentedTestFEParserPacket UndocumentedTestGetSelectionPacket Unequal Unevaluated UniformDistribution UniformGraphDistribution UniformSumDistribution Uninstall Union UnionPlus Unique UnitBox UnitConvert UnitDimensions Unitize UnitRootTest UnitSimplify UnitStep UnitTriangle UnitVector Unprotect UnsameQ UnsavedVariables Unset UnsetShared UntrackedVariables Up UpArrow UpArrowBar UpArrowDownArrow Update UpdateDynamicObjects UpdateDynamicObjectsSynchronous UpdateInterval UpDownArrow UpEquilibrium UpperCaseQ UpperLeftArrow UpperRightArrow UpperTriangularize Upsample UpSet UpSetDelayed UpTee UpTeeArrow UpValues URL URLFetch URLFetchAsynchronous URLSave URLSaveAsynchronous UseGraphicsRange Using UsingFrontEnd ' +
        'V2Get ValidationLength Value ValueBox ValueBoxOptions ValueForm ValueQ ValuesData Variables Variance VarianceEquivalenceTest VarianceEstimatorFunction VarianceGammaDistribution VarianceTest VectorAngle VectorColorFunction VectorColorFunctionScaling VectorDensityPlot VectorGlyphData VectorPlot VectorPlot3D VectorPoints VectorQ Vectors VectorScale VectorStyle Vee Verbatim Verbose VerboseConvertToPostScriptPacket VerifyConvergence VerifySolutions VerifyTestAssumptions Version VersionNumber VertexAdd VertexCapacity VertexColors VertexComponent VertexConnectivity VertexCoordinateRules VertexCoordinates VertexCorrelationSimilarity VertexCosineSimilarity VertexCount VertexCoverQ VertexDataCoordinates VertexDegree VertexDelete VertexDiceSimilarity VertexEccentricity VertexInComponent VertexInDegree VertexIndex VertexJaccardSimilarity VertexLabeling VertexLabels VertexLabelStyle VertexList VertexNormals VertexOutComponent VertexOutDegree VertexQ VertexRenderingFunction VertexReplace VertexShape VertexShapeFunction VertexSize VertexStyle VertexTextureCoordinates VertexWeight Vertical VerticalBar VerticalForm VerticalGauge VerticalSeparator VerticalSlider VerticalTilde ViewAngle ViewCenter ViewMatrix ViewPoint ViewPointSelectorSettings ViewPort ViewRange ViewVector ViewVertical VirtualGroupData Visible VisibleCell VoigtDistribution VonMisesDistribution ' +
        'WaitAll WaitAsynchronousTask WaitNext WaitUntil WakebyDistribution WalleniusHypergeometricDistribution WaringYuleDistribution WatershedComponents WatsonUSquareTest WattsStrogatzGraphDistribution WaveletBestBasis WaveletFilterCoefficients WaveletImagePlot WaveletListPlot WaveletMapIndexed WaveletMatrixPlot WaveletPhi WaveletPsi WaveletScale WaveletScalogram WaveletThreshold WeaklyConnectedComponents WeaklyConnectedGraphQ WeakStationarity WeatherData WeberE Wedge Wednesday WeibullDistribution WeierstrassHalfPeriods WeierstrassInvariants WeierstrassP WeierstrassPPrime WeierstrassSigma WeierstrassZeta WeightedAdjacencyGraph WeightedAdjacencyMatrix WeightedData WeightedGraphQ Weights WelchWindow WheelGraph WhenEvent Which While White Whitespace WhitespaceCharacter WhittakerM WhittakerW WienerFilter WienerProcess WignerD WignerSemicircleDistribution WilksW WilksWTest WindowClickSelect WindowElements WindowFloating WindowFrame WindowFrameElements WindowMargins WindowMovable WindowOpacity WindowSelected WindowSize WindowStatusArea WindowTitle WindowToolbars WindowWidth With WolframAlpha WolframAlphaDate WolframAlphaQuantity WolframAlphaResult Word WordBoundary WordCharacter WordData WordSearch WordSeparators WorkingPrecision Write WriteString Wronskian ' +
        'XMLElement XMLObject Xnor Xor ' +
        'Yellow YuleDissimilarity ' +
        'ZernikeR ZeroSymmetric ZeroTest ZeroWidthTimes Zeta ZetaZero ZipfDistribution ZTest ZTransform ' +
        '$Aborted $ActivationGroupID $ActivationKey $ActivationUserRegistered $AddOnsDirectory $AssertFunction $Assumptions $AsynchronousTask $BaseDirectory $BatchInput $BatchOutput $BoxForms $ByteOrdering $Canceled $CharacterEncoding $CharacterEncodings $CommandLine $CompilationTarget $ConditionHold $ConfiguredKernels $Context $ContextPath $ControlActiveSetting $CreationDate $CurrentLink $DateStringFormat $DefaultFont $DefaultFrontEnd $DefaultImagingDevice $DefaultPath $Display $DisplayFunction $DistributedContexts $DynamicEvaluation $Echo $Epilog $ExportFormats $Failed $FinancialDataSource $FormatType $FrontEnd $FrontEndSession $GeoLocation $HistoryLength $HomeDirectory $HTTPCookies $IgnoreEOF $ImagingDevices $ImportFormats $InitialDirectory $Input $InputFileName $InputStreamMethods $Inspector $InstallationDate $InstallationDirectory $InterfaceEnvironment $IterationLimit $KernelCount $KernelID $Language $LaunchDirectory $LibraryPath $LicenseExpirationDate $LicenseID $LicenseProcesses $LicenseServer $LicenseSubprocesses $LicenseType $Line $Linked $LinkSupported $LoadedFiles $MachineAddresses $MachineDomain $MachineDomains $MachineEpsilon $MachineID $MachineName $MachinePrecision $MachineType $MaxExtraPrecision $MaxLicenseProcesses $MaxLicenseSubprocesses $MaxMachineNumber $MaxNumber $MaxPiecewiseCases $MaxPrecision $MaxRootDegree $MessageGroups $MessageList $MessagePrePrint $Messages $MinMachineNumber $MinNumber $MinorReleaseNumber $MinPrecision $ModuleNumber $NetworkLicense $NewMessage $NewSymbol $Notebooks $NumberMarks $Off $OperatingSystem $Output $OutputForms $OutputSizeLimit $OutputStreamMethods $Packages $ParentLink $ParentProcessID $PasswordFile $PatchLevelID $Path $PathnameSeparator $PerformanceGoal $PipeSupported $Post $Pre $PreferencesDirectory $PrePrint $PreRead $PrintForms $PrintLiteral $ProcessID $ProcessorCount $ProcessorType $ProductInformation $ProgramName $RandomState $RecursionLimit $ReleaseNumber $RootDirectory $ScheduledTask $ScriptCommandLine $SessionID $SetParentLink $SharedFunctions $SharedVariables $SoundDisplay $SoundDisplayFunction $SuppressInputFormHeads $SynchronousEvaluation $SyntaxHandler $System $SystemCharacterEncoding $SystemID $SystemWordLength $TemporaryDirectory $TemporaryPrefix $TextStyle $TimedOut $TimeUnit $TimeZone $TopDirectory $TraceOff $TraceOn $TracePattern $TracePostAction $TracePreAction $Urgent $UserAddOnsDirectory $UserBaseDirectory $UserDocumentsDirectory $UserName $Version $VersionNumber',
        contains: [{
            className: "comment",
            begin: /\(\*/,
            end: /\*\)/
        },
            hljs.APOS_STRING_MODE,
            hljs.QUOTE_STRING_MODE,
            hljs.C_NUMBER_MODE, {
                className: 'list',
                begin: /\{/,
                end: /\}/,
                illegal: /:/
            }
        ]
    };
});
hljs.registerLanguage('matlab', function (hljs) {
    var COMMON_CONTAINS = [
        hljs.C_NUMBER_MODE, {
            className: 'string',
            begin: '\'',
            end: '\'',
            contains: [hljs.BACKSLASH_ESCAPE, {
                begin: '\'\''
            }]
        }
    ];
    var TRANSPOSE = {
        relevance: 0,
        contains: [{
            className: 'operator',
            begin: /'['\.]*/
        }]
    };

    return {
        keywords: {
            keyword: 'break case catch classdef continue else elseif end enumerated events for function ' +
            'global if methods otherwise parfor persistent properties return spmd switch try while',
            built_in: 'sin sind sinh asin asind asinh cos cosd cosh acos acosd acosh tan tand tanh atan ' +
            'atand atan2 atanh sec secd sech asec asecd asech csc cscd csch acsc acscd acsch cot ' +
            'cotd coth acot acotd acoth hypot exp expm1 log log1p log10 log2 pow2 realpow reallog ' +
            'realsqrt sqrt nthroot nextpow2 abs angle complex conj imag real unwrap isreal ' +
            'cplxpair fix floor ceil round mod rem sign airy besselj bessely besselh besseli ' +
            'besselk beta betainc betaln ellipj ellipke erf erfc erfcx erfinv expint gamma ' +
            'gammainc gammaln psi legendre cross dot factor isprime primes gcd lcm rat rats perms ' +
            'nchoosek factorial cart2sph cart2pol pol2cart sph2cart hsv2rgb rgb2hsv zeros ones ' +
            'eye repmat rand randn linspace logspace freqspace meshgrid accumarray size length ' +
            'ndims numel disp isempty isequal isequalwithequalnans cat reshape diag blkdiag tril ' +
            'triu fliplr flipud flipdim rot90 find sub2ind ind2sub bsxfun ndgrid permute ipermute ' +
            'shiftdim circshift squeeze isscalar isvector ans eps realmax realmin pi i inf nan ' +
            'isnan isinf isfinite j why compan gallery hadamard hankel hilb invhilb magic pascal ' +
            'rosser toeplitz vander wilkinson'
        },
        illegal: '(//|"|#|/\\*|\\s+/\\w+)',
        contains: [{
            className: 'function',
            beginKeywords: 'function',
            end: '$',
            contains: [
                hljs.UNDERSCORE_TITLE_MODE, {
                    className: 'params',
                    begin: '\\(',
                    end: '\\)'
                }, {
                    className: 'params',
                    begin: '\\[',
                    end: '\\]'
                }
            ]
        }, {
            begin: /[a-zA-Z_][a-zA-Z_0-9]*'['\.]*/,
            returnBegin: true,
            relevance: 0,
            contains: [{
                begin: /[a-zA-Z_][a-zA-Z_0-9]*/,
                relevance: 0
            },
                TRANSPOSE.contains[0]
            ]
        }, {
            className: 'matrix',
            begin: '\\[',
            end: '\\]',
            contains: COMMON_CONTAINS,
            relevance: 0,
            starts: TRANSPOSE
        }, {
            className: 'cell',
            begin: '\\{',
            end: /}/,
            contains: COMMON_CONTAINS,
            relevance: 0,
            starts: TRANSPOSE
        }, {
            // transpose operators at the end of a function call
            begin: /\)/,
            relevance: 0,
            starts: TRANSPOSE
        }, {
            // Block comment
            className: 'comment',
            begin: '^\\s*\\%\\{\\s*$',
            end: '^\\s*\\%\\}\\s*$'
        }, {
            className: 'comment',
            begin: '\\%',
            end: '$'
        }].concat(COMMON_CONTAINS)
    };
});
hljs.registerLanguage('mel', function (hljs) {
    return {
        keywords: 'int float string vector matrix if else switch case default while do for in break ' +
        'continue global proc return about abs addAttr addAttributeEditorNodeHelp addDynamic ' +
        'addNewShelfTab addPP addPanelCategory addPrefixToName advanceToNextDrivenKey ' +
        'affectedNet affects aimConstraint air alias aliasAttr align alignCtx alignCurve ' +
        'alignSurface allViewFit ambientLight angle angleBetween animCone animCurveEditor ' +
        'animDisplay animView annotate appendStringArray applicationName applyAttrPreset ' +
        'applyTake arcLenDimContext arcLengthDimension arclen arrayMapper art3dPaintCtx ' +
        'artAttrCtx artAttrPaintVertexCtx artAttrSkinPaintCtx artAttrTool artBuildPaintMenu ' +
        'artFluidAttrCtx artPuttyCtx artSelectCtx artSetPaintCtx artUserPaintCtx assignCommand ' +
        'assignInputDevice assignViewportFactories attachCurve attachDeviceAttr attachSurface ' +
        'attrColorSliderGrp attrCompatibility attrControlGrp attrEnumOptionMenu ' +
        'attrEnumOptionMenuGrp attrFieldGrp attrFieldSliderGrp attrNavigationControlGrp ' +
        'attrPresetEditWin attributeExists attributeInfo attributeMenu attributeQuery ' +
        'autoKeyframe autoPlace bakeClip bakeFluidShading bakePartialHistory bakeResults ' +
        'bakeSimulation basename basenameEx batchRender bessel bevel bevelPlus binMembership ' +
        'bindSkin blend2 blendShape blendShapeEditor blendShapePanel blendTwoAttr blindDataType ' +
        'boneLattice boundary boxDollyCtx boxZoomCtx bufferCurve buildBookmarkMenu ' +
        'buildKeyframeMenu button buttonManip CBG cacheFile cacheFileCombine cacheFileMerge ' +
        'cacheFileTrack camera cameraView canCreateManip canvas capitalizeString catch ' +
        'catchQuiet ceil changeSubdivComponentDisplayLevel changeSubdivRegion channelBox ' +
        'character characterMap characterOutlineEditor characterize chdir checkBox checkBoxGrp ' +
        'checkDefaultRenderGlobals choice circle circularFillet clamp clear clearCache clip ' +
        'clipEditor clipEditorCurrentTimeCtx clipSchedule clipSchedulerOutliner clipTrimBefore ' +
        'closeCurve closeSurface cluster cmdFileOutput cmdScrollFieldExecuter ' +
        'cmdScrollFieldReporter cmdShell coarsenSubdivSelectionList collision color ' +
        'colorAtPoint colorEditor colorIndex colorIndexSliderGrp colorSliderButtonGrp ' +
        'colorSliderGrp columnLayout commandEcho commandLine commandPort compactHairSystem ' +
        'componentEditor compositingInterop computePolysetVolume condition cone confirmDialog ' +
        'connectAttr connectControl connectDynamic connectJoint connectionInfo constrain ' +
        'constrainValue constructionHistory container containsMultibyte contextInfo control ' +
        'convertFromOldLayers convertIffToPsd convertLightmap convertSolidTx convertTessellation ' +
        'convertUnit copyArray copyFlexor copyKey copySkinWeights cos cpButton cpCache ' +
        'cpClothSet cpCollision cpConstraint cpConvClothToMesh cpForces cpGetSolverAttr cpPanel ' +
        'cpProperty cpRigidCollisionFilter cpSeam cpSetEdit cpSetSolverAttr cpSolver ' +
        'cpSolverTypes cpTool cpUpdateClothUVs createDisplayLayer createDrawCtx createEditor ' +
        'createLayeredPsdFile createMotionField createNewShelf createNode createRenderLayer ' +
        'createSubdivRegion cross crossProduct ctxAbort ctxCompletion ctxEditMode ctxTraverse ' +
        'currentCtx currentTime currentTimeCtx currentUnit curve curveAddPtCtx ' +
        'curveCVCtx curveEPCtx curveEditorCtx curveIntersect curveMoveEPCtx curveOnSurface ' +
        'curveSketchCtx cutKey cycleCheck cylinder dagPose date defaultLightListCheckBox ' +
        'defaultNavigation defineDataServer defineVirtualDevice deformer deg_to_rad delete ' +
        'deleteAttr deleteShadingGroupsAndMaterials deleteShelfTab deleteUI deleteUnusedBrushes ' +
        'delrandstr detachCurve detachDeviceAttr detachSurface deviceEditor devicePanel dgInfo ' +
        'dgdirty dgeval dgtimer dimWhen directKeyCtx directionalLight dirmap dirname disable ' +
        'disconnectAttr disconnectJoint diskCache displacementToPoly displayAffected ' +
        'displayColor displayCull displayLevelOfDetail displayPref displayRGBColor ' +
        'displaySmoothness displayStats displayString displaySurface distanceDimContext ' +
        'distanceDimension doBlur dolly dollyCtx dopeSheetEditor dot dotProduct ' +
        'doubleProfileBirailSurface drag dragAttrContext draggerContext dropoffLocator ' +
        'duplicate duplicateCurve duplicateSurface dynCache dynControl dynExport dynExpression ' +
        'dynGlobals dynPaintEditor dynParticleCtx dynPref dynRelEdPanel dynRelEditor ' +
        'dynamicLoad editAttrLimits editDisplayLayerGlobals editDisplayLayerMembers ' +
        'editRenderLayerAdjustment editRenderLayerGlobals editRenderLayerMembers editor ' +
        'editorTemplate effector emit emitter enableDevice encodeString endString endsWith env ' +
        'equivalent equivalentTol erf error eval evalDeferred evalEcho event ' +
        'exactWorldBoundingBox exclusiveLightCheckBox exec executeForEachObject exists exp ' +
        'expression expressionEditorListen extendCurve extendSurface extrude fcheck fclose feof ' +
        'fflush fgetline fgetword file fileBrowserDialog fileDialog fileExtension fileInfo ' +
        'filetest filletCurve filter filterCurve filterExpand filterStudioImport ' +
        'findAllIntersections findAnimCurves findKeyframe findMenuItem findRelatedSkinCluster ' +
        'finder firstParentOf fitBspline flexor floatEq floatField floatFieldGrp floatScrollBar ' +
        'floatSlider floatSlider2 floatSliderButtonGrp floatSliderGrp floor flow fluidCacheInfo ' +
        'fluidEmitter fluidVoxelInfo flushUndo fmod fontDialog fopen formLayout format fprint ' +
        'frameLayout fread freeFormFillet frewind fromNativePath fwrite gamma gauss ' +
        'geometryConstraint getApplicationVersionAsFloat getAttr getClassification ' +
        'getDefaultBrush getFileList getFluidAttr getInputDeviceRange getMayaPanelTypes ' +
        'getModifiers getPanel getParticleAttr getPluginResource getenv getpid glRender ' +
        'glRenderEditor globalStitch gmatch goal gotoBindPose grabColor gradientControl ' +
        'gradientControlNoAttr graphDollyCtx graphSelectContext graphTrackCtx gravity grid ' +
        'gridLayout group groupObjectsByName HfAddAttractorToAS HfAssignAS HfBuildEqualMap ' +
        'HfBuildFurFiles HfBuildFurImages HfCancelAFR HfConnectASToHF HfCreateAttractor ' +
        'HfDeleteAS HfEditAS HfPerformCreateAS HfRemoveAttractorFromAS HfSelectAttached ' +
        'HfSelectAttractors HfUnAssignAS hardenPointCurve hardware hardwareRenderPanel ' +
        'headsUpDisplay headsUpMessage help helpLine hermite hide hilite hitTest hotBox hotkey ' +
        'hotkeyCheck hsv_to_rgb hudButton hudSlider hudSliderButton hwReflectionMap hwRender ' +
        'hwRenderLoad hyperGraph hyperPanel hyperShade hypot iconTextButton iconTextCheckBox ' +
        'iconTextRadioButton iconTextRadioCollection iconTextScrollList iconTextStaticLabel ' +
        'ikHandle ikHandleCtx ikHandleDisplayScale ikSolver ikSplineHandleCtx ikSystem ' +
        'ikSystemInfo ikfkDisplayMethod illustratorCurves image imfPlugins inheritTransform ' +
        'insertJoint insertJointCtx insertKeyCtx insertKnotCurve insertKnotSurface instance ' +
        'instanceable instancer intField intFieldGrp intScrollBar intSlider intSliderGrp ' +
        'interToUI internalVar intersect iprEngine isAnimCurve isConnected isDirty isParentOf ' +
        'isSameObject isTrue isValidObjectName isValidString isValidUiName isolateSelect ' +
        'itemFilter itemFilterAttr itemFilterRender itemFilterType joint jointCluster jointCtx ' +
        'jointDisplayScale jointLattice keyTangent keyframe keyframeOutliner ' +
        'keyframeRegionCurrentTimeCtx keyframeRegionDirectKeyCtx keyframeRegionDollyCtx ' +
        'keyframeRegionInsertKeyCtx keyframeRegionMoveKeyCtx keyframeRegionScaleKeyCtx ' +
        'keyframeRegionSelectKeyCtx keyframeRegionSetKeyCtx keyframeRegionTrackCtx ' +
        'keyframeStats lassoContext lattice latticeDeformKeyCtx launch launchImageEditor ' +
        'layerButton layeredShaderPort layeredTexturePort layout layoutDialog lightList ' +
        'lightListEditor lightListPanel lightlink lineIntersection linearPrecision linstep ' +
        'listAnimatable listAttr listCameras listConnections listDeviceAttachments listHistory ' +
        'listInputDeviceAxes listInputDeviceButtons listInputDevices listMenuAnnotation ' +
        'listNodeTypes listPanelCategories listRelatives listSets listTransforms ' +
        'listUnselected listerEditor loadFluid loadNewShelf loadPlugin ' +
        'loadPluginLanguageResources loadPrefObjects localizedPanelLabel lockNode loft log ' +
        'longNameOf lookThru ls lsThroughFilter lsType lsUI Mayatomr mag makeIdentity makeLive ' +
        'makePaintable makeRoll makeSingleSurface makeTubeOn makebot manipMoveContext ' +
        'manipMoveLimitsCtx manipOptions manipRotateContext manipRotateLimitsCtx ' +
        'manipScaleContext manipScaleLimitsCtx marker match max memory menu menuBarLayout ' +
        'menuEditor menuItem menuItemToShelf menuSet menuSetPref messageLine min minimizeApp ' +
        'mirrorJoint modelCurrentTimeCtx modelEditor modelPanel mouse movIn movOut move ' +
        'moveIKtoFK moveKeyCtx moveVertexAlongDirection multiProfileBirailSurface mute ' +
        'nParticle nameCommand nameField namespace namespaceInfo newPanelItems newton nodeCast ' +
        'nodeIconButton nodeOutliner nodePreset nodeType noise nonLinear normalConstraint ' +
        'normalize nurbsBoolean nurbsCopyUVSet nurbsCube nurbsEditUV nurbsPlane nurbsSelect ' +
        'nurbsSquare nurbsToPoly nurbsToPolygonsPref nurbsToSubdiv nurbsToSubdivPref ' +
        'nurbsUVSet nurbsViewDirectionVector objExists objectCenter objectLayer objectType ' +
        'objectTypeUI obsoleteProc oceanNurbsPreviewPlane offsetCurve offsetCurveOnSurface ' +
        'offsetSurface openGLExtension openMayaPref optionMenu optionMenuGrp optionVar orbit ' +
        'orbitCtx orientConstraint outlinerEditor outlinerPanel overrideModifier ' +
        'paintEffectsDisplay pairBlend palettePort paneLayout panel panelConfiguration ' +
        'panelHistory paramDimContext paramDimension paramLocator parent parentConstraint ' +
        'particle particleExists particleInstancer particleRenderInfo partition pasteKey ' +
        'pathAnimation pause pclose percent performanceOptions pfxstrokes pickWalk picture ' +
        'pixelMove planarSrf plane play playbackOptions playblast plugAttr plugNode pluginInfo ' +
        'pluginResourceUtil pointConstraint pointCurveConstraint pointLight pointMatrixMult ' +
        'pointOnCurve pointOnSurface pointPosition poleVectorConstraint polyAppend ' +
        'polyAppendFacetCtx polyAppendVertex polyAutoProjection polyAverageNormal ' +
        'polyAverageVertex polyBevel polyBlendColor polyBlindData polyBoolOp polyBridgeEdge ' +
        'polyCacheMonitor polyCheck polyChipOff polyClipboard polyCloseBorder polyCollapseEdge ' +
        'polyCollapseFacet polyColorBlindData polyColorDel polyColorPerVertex polyColorSet ' +
        'polyCompare polyCone polyCopyUV polyCrease polyCreaseCtx polyCreateFacet ' +
        'polyCreateFacetCtx polyCube polyCut polyCutCtx polyCylinder polyCylindricalProjection ' +
        'polyDelEdge polyDelFacet polyDelVertex polyDuplicateAndConnect polyDuplicateEdge ' +
        'polyEditUV polyEditUVShell polyEvaluate polyExtrudeEdge polyExtrudeFacet ' +
        'polyExtrudeVertex polyFlipEdge polyFlipUV polyForceUV polyGeoSampler polyHelix ' +
        'polyInfo polyInstallAction polyLayoutUV polyListComponentConversion polyMapCut ' +
        'polyMapDel polyMapSew polyMapSewMove polyMergeEdge polyMergeEdgeCtx polyMergeFacet ' +
        'polyMergeFacetCtx polyMergeUV polyMergeVertex polyMirrorFace polyMoveEdge ' +
        'polyMoveFacet polyMoveFacetUV polyMoveUV polyMoveVertex polyNormal polyNormalPerVertex ' +
        'polyNormalizeUV polyOptUvs polyOptions polyOutput polyPipe polyPlanarProjection ' +
        'polyPlane polyPlatonicSolid polyPoke polyPrimitive polyPrism polyProjection ' +
        'polyPyramid polyQuad polyQueryBlindData polyReduce polySelect polySelectConstraint ' +
        'polySelectConstraintMonitor polySelectCtx polySelectEditCtx polySeparate ' +
        'polySetToFaceNormal polySewEdge polyShortestPathCtx polySmooth polySoftEdge ' +
        'polySphere polySphericalProjection polySplit polySplitCtx polySplitEdge polySplitRing ' +
        'polySplitVertex polyStraightenUVBorder polySubdivideEdge polySubdivideFacet ' +
        'polyToSubdiv polyTorus polyTransfer polyTriangulate polyUVSet polyUnite polyWedgeFace ' +
        'popen popupMenu pose pow preloadRefEd print progressBar progressWindow projFileViewer ' +
        'projectCurve projectTangent projectionContext projectionManip promptDialog propModCtx ' +
        'propMove psdChannelOutliner psdEditTextureFile psdExport psdTextureFile putenv pwd ' +
        'python querySubdiv quit rad_to_deg radial radioButton radioButtonGrp radioCollection ' +
        'radioMenuItemCollection rampColorPort rand randomizeFollicles randstate rangeControl ' +
        'readTake rebuildCurve rebuildSurface recordAttr recordDevice redo reference ' +
        'referenceEdit referenceQuery refineSubdivSelectionList refresh refreshAE ' +
        'registerPluginResource rehash reloadImage removeJoint removeMultiInstance ' +
        'removePanelCategory rename renameAttr renameSelectionList renameUI render ' +
        'renderGlobalsNode renderInfo renderLayerButton renderLayerParent ' +
        'renderLayerPostProcess renderLayerUnparent renderManip renderPartition ' +
        'renderQualityNode renderSettings renderThumbnailUpdate renderWindowEditor ' +
        'renderWindowSelectContext renderer reorder reorderDeformers requires reroot ' +
        'resampleFluid resetAE resetPfxToPolyCamera resetTool resolutionNode retarget ' +
        'reverseCurve reverseSurface revolve rgb_to_hsv rigidBody rigidSolver roll rollCtx ' +
        'rootOf rot rotate rotationInterpolation roundConstantRadius rowColumnLayout rowLayout ' +
        'runTimeCommand runup sampleImage saveAllShelves saveAttrPreset saveFluid saveImage ' +
        'saveInitialState saveMenu savePrefObjects savePrefs saveShelf saveToolSettings scale ' +
        'scaleBrushBrightness scaleComponents scaleConstraint scaleKey scaleKeyCtx sceneEditor ' +
        'sceneUIReplacement scmh scriptCtx scriptEditorInfo scriptJob scriptNode scriptTable ' +
        'scriptToShelf scriptedPanel scriptedPanelType scrollField scrollLayout sculpt ' +
        'searchPathArray seed selLoadSettings select selectContext selectCurveCV selectKey ' +
        'selectKeyCtx selectKeyframeRegionCtx selectMode selectPref selectPriority selectType ' +
        'selectedNodes selectionConnection separator setAttr setAttrEnumResource ' +
        'setAttrMapping setAttrNiceNameResource setConstraintRestPosition ' +
        'setDefaultShadingGroup setDrivenKeyframe setDynamic setEditCtx setEditor setFluidAttr ' +
        'setFocus setInfinity setInputDeviceMapping setKeyCtx setKeyPath setKeyframe ' +
        'setKeyframeBlendshapeTargetWts setMenuMode setNodeNiceNameResource setNodeTypeFlag ' +
        'setParent setParticleAttr setPfxToPolyCamera setPluginResource setProject ' +
        'setStampDensity setStartupMessage setState setToolTo setUITemplate setXformManip sets ' +
        'shadingConnection shadingGeometryRelCtx shadingLightRelCtx shadingNetworkCompare ' +
        'shadingNode shapeCompare shelfButton shelfLayout shelfTabLayout shellField ' +
        'shortNameOf showHelp showHidden showManipCtx showSelectionInTitle ' +
        'showShadingGroupAttrEditor showWindow sign simplify sin singleProfileBirailSurface ' +
        'size sizeBytes skinCluster skinPercent smoothCurve smoothTangentSurface smoothstep ' +
        'snap2to2 snapKey snapMode snapTogetherCtx snapshot soft softMod softModCtx sort sound ' +
        'soundControl source spaceLocator sphere sphrand spotLight spotLightPreviewPort ' +
        'spreadSheetEditor spring sqrt squareSurface srtContext stackTrace startString ' +
        'startsWith stitchAndExplodeShell stitchSurface stitchSurfacePoints strcmp ' +
        'stringArrayCatenate stringArrayContains stringArrayCount stringArrayInsertAtIndex ' +
        'stringArrayIntersector stringArrayRemove stringArrayRemoveAtIndex ' +
        'stringArrayRemoveDuplicates stringArrayRemoveExact stringArrayToString ' +
        'stringToStringArray strip stripPrefixFromName stroke subdAutoProjection ' +
        'subdCleanTopology subdCollapse subdDuplicateAndConnect subdEditUV ' +
        'subdListComponentConversion subdMapCut subdMapSewMove subdMatchTopology subdMirror ' +
        'subdToBlind subdToPoly subdTransferUVsToCache subdiv subdivCrease ' +
        'subdivDisplaySmoothness substitute substituteAllString substituteGeometry substring ' +
        'surface surfaceSampler surfaceShaderList swatchDisplayPort switchTable symbolButton ' +
        'symbolCheckBox sysFile system tabLayout tan tangentConstraint texLatticeDeformContext ' +
        'texManipContext texMoveContext texMoveUVShellContext texRotateContext texScaleContext ' +
        'texSelectContext texSelectShortestPathCtx texSmudgeUVContext texWinToolCtx text ' +
        'textCurves textField textFieldButtonGrp textFieldGrp textManip textScrollList ' +
        'textToShelf textureDisplacePlane textureHairColor texturePlacementContext ' +
        'textureWindow threadCount threePointArcCtx timeControl timePort timerX toNativePath ' +
        'toggle toggleAxis toggleWindowVisibility tokenize tokenizeList tolerance tolower ' +
        'toolButton toolCollection toolDropped toolHasOptions toolPropertyWindow torus toupper ' +
        'trace track trackCtx transferAttributes transformCompare transformLimits translator ' +
        'trim trunc truncateFluidCache truncateHairCache tumble tumbleCtx turbulence ' +
        'twoPointArcCtx uiRes uiTemplate unassignInputDevice undo undoInfo ungroup uniform unit ' +
        'unloadPlugin untangleUV untitledFileName untrim upAxis updateAE userCtx uvLink ' +
        'uvSnapshot validateShelfName vectorize view2dToolCtx viewCamera viewClipPlane ' +
        'viewFit viewHeadOn viewLookAt viewManip viewPlace viewSet visor volumeAxis vortex ' +
        'waitCursor warning webBrowser webBrowserPrefs whatIs window windowPref wire ' +
        'wireContext workspace wrinkle wrinkleContext writeTake xbmLangPathList xform',
        illegal: '</',
        contains: [
            hljs.C_NUMBER_MODE,
            hljs.APOS_STRING_MODE,
            hljs.QUOTE_STRING_MODE, {
                className: 'string',
                begin: '`',
                end: '`',
                contains: [hljs.BACKSLASH_ESCAPE]
            }, {
                className: 'variable',
                variants: [{
                    begin: '\\$\\d'
                }, {
                    begin: '[\\$\\%\\@](\\^\\w\\b|#\\w+|[^\\s\\w{]|{\\w+}|\\w+)'
                }, {
                    begin: '\\*(\\^\\w\\b|#\\w+|[^\\s\\w{]|{\\w+}|\\w+)',
                    relevance: 0
                }]
            },
            hljs.C_LINE_COMMENT_MODE,
            hljs.C_BLOCK_COMMENT_MODE
        ]
    };
});
hljs.registerLanguage('mercury', function (hljs) {
    var KEYWORDS = {
        keyword: 'module use_module import_module include_module end_module initialise ' +
        'mutable initialize finalize finalise interface implementation pred ' +
        'mode func type inst solver any_pred any_func is semidet det nondet ' +
        'multi erroneous failure cc_nondet cc_multi typeclass instance where ' +
        'pragma promise external trace atomic or_else require_complete_switch ' +
        'require_det require_semidet require_multi require_nondet ' +
        'require_cc_multi require_cc_nondet require_erroneous require_failure',
        pragma: 'inline no_inline type_spec source_file fact_table obsolete memo ' +
        'loop_check minimal_model terminates does_not_terminate ' +
        'check_termination promise_equivalent_clauses',
        preprocessor: 'foreign_proc foreign_decl foreign_code foreign_type ' +
        'foreign_import_module foreign_export_enum foreign_export ' +
        'foreign_enum may_call_mercury will_not_call_mercury thread_safe ' +
        'not_thread_safe maybe_thread_safe promise_pure promise_semipure ' +
        'tabled_for_io local untrailed trailed attach_to_io_state ' +
        'can_pass_as_mercury_type stable will_not_throw_exception ' +
        'may_modify_trail will_not_modify_trail may_duplicate ' +
        'may_not_duplicate affects_liveness does_not_affect_liveness ' +
        'doesnt_affect_liveness no_sharing unknown_sharing sharing',
        built_in: 'some all not if then else true fail false try catch catch_any ' +
        'semidet_true semidet_false semidet_fail impure_true impure semipure'
    };

    var TODO = {
        className: 'label',
        begin: 'XXX',
        end: '$',
        endsWithParent: true,
        relevance: 0
    };
    var COMMENT = hljs.inherit(hljs.C_LINE_COMMENT_MODE, {
        begin: '%'
    });
    var CCOMMENT = hljs.inherit(hljs.C_BLOCK_COMMENT_MODE, {
        relevance: 0
    });
    COMMENT.contains.push(TODO);
    CCOMMENT.contains.push(TODO);

    var NUMCODE = {
        className: 'number',
        begin: "0'.\\|0[box][0-9a-fA-F]*"
    };

    var ATOM = hljs.inherit(hljs.APOS_STRING_MODE, {
        relevance: 0
    });
    var STRING = hljs.inherit(hljs.QUOTE_STRING_MODE, {
        relevance: 0
    });
    var STRING_FMT = {
        className: 'constant',
        begin: '\\\\[abfnrtv]\\|\\\\x[0-9a-fA-F]*\\\\\\|%[-+# *.0-9]*[dioxXucsfeEgGp]',
        relevance: 0
    };
    STRING.contains.push(STRING_FMT);

    var IMPLICATION = {
        className: 'built_in',
        variants: [{
            begin: '<=>'
        }, {
            begin: '<=',
            relevance: 0
        }, {
            begin: '=>',
            relevance: 0
        }, {
            begin: '/\\\\'
        }, {
            begin: '\\\\/'
        }]
    };

    var HEAD_BODY_CONJUNCTION = {
        className: 'built_in',
        variants: [{
            begin: ':-\\|-->'
        }, {
            begin: '=',
            relevance: 0
        }]
    };

    return {
        aliases: ['m', 'moo'],
        keywords: KEYWORDS,
        contains: [
            IMPLICATION,
            HEAD_BODY_CONJUNCTION,
            COMMENT,
            CCOMMENT,
            NUMCODE,
            hljs.NUMBER_MODE,
            ATOM,
            STRING, {
                begin: /:-/
            } // relevance booster
        ]
    };
});
hljs.registerLanguage('mizar', function (hljs) {
    return {
        keywords: 'environ vocabularies notations constructors definitions ' +
        'registrations theorems schemes requirements begin end definition ' +
        'registration cluster existence pred func defpred deffunc theorem ' +
        'proof let take assume then thus hence ex for st holds consider ' +
        'reconsider such that and in provided of as from be being by means ' +
        'equals implies iff redefine define now not or attr is mode ' +
        'suppose per cases set thesis contradiction scheme reserve struct ' +
        'correctness compatibility coherence symmetry assymetry ' +
        'reflexivity irreflexivity connectedness uniqueness commutativity ' +
        'idempotence involutiveness projectivity',
        contains: [{
            className: 'comment',
            begin: '::',
            end: '$'
        }]
    };
});
hljs.registerLanguage('monkey', function (hljs) {
    var NUMBER = {
        className: 'number',
        relevance: 0,
        variants: [{
            begin: '[$][a-fA-F0-9]+'
        },
            hljs.NUMBER_MODE
        ]
    };

    return {
        case_insensitive: true,
        keywords: {
            keyword: 'public private property continue exit extern new try catch ' +
            'eachin not abstract final select case default const local global field ' +
            'end if then else elseif endif while wend repeat until forever for to step next return module inline throw',

            built_in: 'DebugLog DebugStop Error Print ACos ACosr ASin ASinr ATan ATan2 ATan2r ATanr Abs Abs Ceil ' +
            'Clamp Clamp Cos Cosr Exp Floor Log Max Max Min Min Pow Sgn Sgn Sin Sinr Sqrt Tan Tanr Seed PI HALFPI TWOPI',

            literal: 'true false null and or shl shr mod'
        },
        contains: [{
            className: 'comment',
            begin: '#rem',
            end: '#end'
        }, {
            className: 'comment',
            begin: "'",
            end: '$',
            relevance: 0
        }, {
            className: 'function',
            beginKeywords: 'function method',
            end: '[(=:]|$',
            illegal: /\n/,
            contains: [
                hljs.UNDERSCORE_TITLE_MODE,
            ]
        }, {
            className: 'class',
            beginKeywords: 'class interface',
            end: '$',
            contains: [{
                beginKeywords: 'extends implements'
            },
                hljs.UNDERSCORE_TITLE_MODE
            ]
        }, {
            className: 'variable',
            begin: '\\b(self|super)\\b'
        }, {
            className: 'preprocessor',
            beginKeywords: 'import',
            end: '$'
        }, {
            className: 'preprocessor',
            begin: '\\s*#',
            end: '$',
            keywords: 'if else elseif endif end then'
        }, {
            className: 'pi',
            begin: '^\\s*strict\\b'
        }, {
            beginKeywords: 'alias',
            end: '=',
            contains: [hljs.UNDERSCORE_TITLE_MODE]
        },
            hljs.QUOTE_STRING_MODE,
            NUMBER
        ]
    }
});
hljs.registerLanguage('nginx', function (hljs) {
    var VAR = {
        className: 'variable',
        variants: [{
            begin: /\$\d+/
        }, {
            begin: /\$\{/,
            end: /}/
        }, {
            begin: '[\\$\\@]' + hljs.UNDERSCORE_IDENT_RE
        }]
    };
    var DEFAULT = {
        endsWithParent: true,
        lexemes: '[a-z/_]+',
        keywords: {
            built_in: 'on off yes no true false none blocked debug info notice warn error crit ' +
            'select break last permanent redirect kqueue rtsig epoll poll /dev/poll'
        },
        relevance: 0,
        illegal: '=>',
        contains: [
            hljs.HASH_COMMENT_MODE, {
                className: 'string',
                contains: [hljs.BACKSLASH_ESCAPE, VAR],
                variants: [{
                    begin: /"/,
                    end: /"/
                }, {
                    begin: /'/,
                    end: /'/
                }]
            }, {
                className: 'url',
                begin: '([a-z]+):/',
                end: '\\s',
                endsWithParent: true,
                excludeEnd: true,
                contains: [VAR]
            }, {
                className: 'regexp',
                contains: [hljs.BACKSLASH_ESCAPE, VAR],
                variants: [{
                    begin: "\\s\\^",
                    end: "\\s|{|;",
                    returnEnd: true
                },
                    // regexp locations (~, ~*)
                    {
                        begin: "~\\*?\\s+",
                        end: "\\s|{|;",
                        returnEnd: true
                    },
                    // *.example.com
                    {
                        begin: "\\*(\\.[a-z\\-]+)+"
                    },
                    // sub.example.*
                    {
                        begin: "([a-z\\-]+\\.)+\\*"
                    }
                ]
            },
            // IP
            {
                className: 'number',
                begin: '\\b\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}(:\\d{1,5})?\\b'
            },
            // units
            {
                className: 'number',
                begin: '\\b\\d+[kKmMgGdshdwy]*\\b',
                relevance: 0
            },
            VAR
        ]
    };

    return {
        aliases: ['nginxconf'],
        contains: [
            hljs.HASH_COMMENT_MODE, {
                begin: hljs.UNDERSCORE_IDENT_RE + '\\s',
                end: ';|{',
                returnBegin: true,
                contains: [{
                    className: 'title',
                    begin: hljs.UNDERSCORE_IDENT_RE,
                    starts: DEFAULT
                }],
                relevance: 0
            }
        ],
        illegal: '[^\\s\\}]'
    };
});
hljs.registerLanguage('nimrod', function (hljs) {
    return {
        aliases: ['nim'],
        keywords: {
            keyword: 'addr and as asm bind block break|0 case|0 cast const|0 continue|0 converter discard distinct|10 div do elif else|0 end|0 enum|0 except export finally for from generic if|0 import|0 in include|0 interface is isnot|10 iterator|10 let|0 macro method|10 mixin mod nil not notin|10 object|0 of or out proc|10 ptr raise ref|10 return shl shr static template|10 try|0 tuple type|0 using|0 var|0 when while|0 with without xor yield',
            literal: 'shared guarded stdin stdout stderr result|10 true false'
        },
        contains: [{
            className: 'decorator', // Actually pragma
            begin: /{\./,
            end: /\.}/,
            relevance: 10
        }, {
            className: 'string',
            begin: /[a-zA-Z]\w*"/,
            end: /"/,
            contains: [{
                begin: /""/
            }]
        }, {
            className: 'string',
            begin: /([a-zA-Z]\w*)?"""/,
            end: /"""/
        }, {
            className: 'string',
            begin: /"/,
            end: /"/,
            illegal: /\n/,
            contains: [{
                begin: /\\./
            }]
        }, {
            className: 'type',
            begin: /\b[A-Z]\w+\b/,
            relevance: 0
        }, {
            className: 'type',
            begin: /\b(int|int8|int16|int32|int64|uint|uint8|uint16|uint32|uint64|float|float32|float64|bool|char|string|cstring|pointer|expr|stmt|void|auto|any|range|array|openarray|varargs|seq|set|clong|culong|cchar|cschar|cshort|cint|csize|clonglong|cfloat|cdouble|clongdouble|cuchar|cushort|cuint|culonglong|cstringarray|semistatic)\b/
        }, {
            className: 'number',
            begin: /\b(0[xX][0-9a-fA-F][_0-9a-fA-F]*)('?[iIuU](8|16|32|64))?/,
            relevance: 0
        }, {
            className: 'number',
            begin: /\b(0o[0-7][_0-7]*)('?[iIuUfF](8|16|32|64))?/,
            relevance: 0
        }, {
            className: 'number',
            begin: /\b(0(b|B)[01][_01]*)('?[iIuUfF](8|16|32|64))?/,
            relevance: 0
        }, {
            className: 'number',
            begin: /\b(\d[_\d]*)('?[iIuUfF](8|16|32|64))?/,
            relevance: 0
        },
            hljs.HASH_COMMENT_MODE
        ]
    }
});
hljs.registerLanguage('nix', function (hljs) {
    var NIX_KEYWORDS = {
        keyword: 'rec with let in inherit assert if else then',
        constant: 'true false or and null',
        built_in: 'import abort baseNameOf dirOf isNull builtins map removeAttrs throw toString derivation'
    };
    var ANTIQUOTE = {
        className: 'subst',
        begin: /\$\{/,
        end: /}/,
        keywords: NIX_KEYWORDS
    };
    var ATTRS = {
        className: 'variable',
        // TODO: we have to figure out a way how to exclude \s*=
        begin: /[a-zA-Z0-9-_]+(\s*=)/
    };
    var SINGLE_QUOTE = {
        className: 'string',
        begin: "''",
        end: "''",
        contains: [
            ANTIQUOTE
        ]
    };
    var DOUBLE_QUOTE = {
        className: 'string',
        begin: '"',
        end: '"',
        contains: [
            ANTIQUOTE
        ]
    };
    var EXPRESSIONS = [
        hljs.NUMBER_MODE,
        hljs.HASH_COMMENT_MODE,
        hljs.C_BLOCK_COMMENT_MODE,
        SINGLE_QUOTE,
        DOUBLE_QUOTE,
        ATTRS
    ];
    ANTIQUOTE.contains = EXPRESSIONS;
    return {
        aliases: ["nixos"],
        keywords: NIX_KEYWORDS,
        contains: EXPRESSIONS
    };
});
hljs.registerLanguage('nsis', function (hljs) {
    var CONSTANTS = {
        className: 'symbol',
        begin: '\\$(ADMINTOOLS|APPDATA|CDBURN_AREA|CMDLINE|COMMONFILES32|COMMONFILES64|COMMONFILES|COOKIES|DESKTOP|DOCUMENTS|EXEDIR|EXEFILE|EXEPATH|FAVORITES|FONTS|HISTORY|HWNDPARENT|INSTDIR|INTERNET_CACHE|LANGUAGE|LOCALAPPDATA|MUSIC|NETHOOD|OUTDIR|PICTURES|PLUGINSDIR|PRINTHOOD|PROFILE|PROGRAMFILES32|PROGRAMFILES64|PROGRAMFILES|QUICKLAUNCH|RECENT|RESOURCES_LOCALIZED|RESOURCES|SENDTO|SMPROGRAMS|SMSTARTUP|STARTMENU|SYSDIR|TEMP|TEMPLATES|VIDEOS|WINDIR)'
    };

    var DEFINES = {
        // ${defines}
        className: 'constant',
        begin: '\\$+{[a-zA-Z0-9_]+}'
    };

    var VARIABLES = {
        // $variables
        className: 'variable',
        begin: '\\$+[a-zA-Z0-9_]+',
        illegal: '\\(\\){}'
    };

    var LANGUAGES = {
        // $(language_strings)
        className: 'constant',
        begin: '\\$+\\([a-zA-Z0-9_]+\\)'
    };

    var PARAMETERS = {
        // command parameters
        className: 'params',
        begin: '(ARCHIVE|FILE_ATTRIBUTE_ARCHIVE|FILE_ATTRIBUTE_NORMAL|FILE_ATTRIBUTE_OFFLINE|FILE_ATTRIBUTE_READONLY|FILE_ATTRIBUTE_SYSTEM|FILE_ATTRIBUTE_TEMPORARY|HKCR|HKCU|HKDD|HKEY_CLASSES_ROOT|HKEY_CURRENT_CONFIG|HKEY_CURRENT_USER|HKEY_DYN_DATA|HKEY_LOCAL_MACHINE|HKEY_PERFORMANCE_DATA|HKEY_USERS|HKLM|HKPD|HKU|IDABORT|IDCANCEL|IDIGNORE|IDNO|IDOK|IDRETRY|IDYES|MB_ABORTRETRYIGNORE|MB_DEFBUTTON1|MB_DEFBUTTON2|MB_DEFBUTTON3|MB_DEFBUTTON4|MB_ICONEXCLAMATION|MB_ICONINFORMATION|MB_ICONQUESTION|MB_ICONSTOP|MB_OK|MB_OKCANCEL|MB_RETRYCANCEL|MB_RIGHT|MB_RTLREADING|MB_SETFOREGROUND|MB_TOPMOST|MB_USERICON|MB_YESNO|NORMAL|OFFLINE|READONLY|SHCTX|SHELL_CONTEXT|SYSTEM|TEMPORARY)'
    };

    var COMPILER = {
        // !compiler_flags
        className: 'constant',
        begin: '\\!(addincludedir|addplugindir|appendfile|cd|define|delfile|echo|else|endif|error|execute|finalize|getdllversionsystem|ifdef|ifmacrodef|ifmacrondef|ifndef|if|include|insertmacro|macroend|macro|makensis|packhdr|searchparse|searchreplace|tempfile|undef|verbose|warning)'
    };

    return {
        case_insensitive: false,
        keywords: {
            keyword: 'Abort AddBrandingImage AddSize AllowRootDirInstall AllowSkipFiles AutoCloseWindow BGFont BGGradient BrandingText BringToFront Call CallInstDLL Caption ChangeUI CheckBitmap ClearErrors CompletedText ComponentText CopyFiles CRCCheck CreateDirectory CreateFont CreateShortCut Delete DeleteINISec DeleteINIStr DeleteRegKey DeleteRegValue DetailPrint DetailsButtonText DirText DirVar DirVerify EnableWindow EnumRegKey EnumRegValue Exch Exec ExecShell ExecWait ExpandEnvStrings File FileBufSize FileClose FileErrorText FileOpen FileRead FileReadByte FileReadUTF16LE FileReadWord FileSeek FileWrite FileWriteByte FileWriteUTF16LE FileWriteWord FindClose FindFirst FindNext FindWindow FlushINI FunctionEnd GetCurInstType GetCurrentAddress GetDlgItem GetDLLVersion GetDLLVersionLocal GetErrorLevel GetFileTime GetFileTimeLocal GetFullPathName GetFunctionAddress GetInstDirError GetLabelAddress GetTempFileName Goto HideWindow Icon IfAbort IfErrors IfFileExists IfRebootFlag IfSilent InitPluginsDir InstallButtonText InstallColors InstallDir InstallDirRegKey InstProgressFlags InstType InstTypeGetText InstTypeSetText IntCmp IntCmpU IntFmt IntOp IsWindow LangString LicenseBkColor LicenseData LicenseForceSelection LicenseLangString LicenseText LoadLanguageFile LockWindow LogSet LogText ManifestDPIAware ManifestSupportedOS MessageBox MiscButtonText Name Nop OutFile Page PageCallbacks PageExEnd Pop Push Quit ReadEnvStr ReadINIStr ReadRegDWORD ReadRegStr Reboot RegDLL Rename RequestExecutionLevel ReserveFile Return RMDir SearchPath SectionEnd SectionGetFlags SectionGetInstTypes SectionGetSize SectionGetText SectionGroupEnd SectionIn SectionSetFlags SectionSetInstTypes SectionSetSize SectionSetText SendMessage SetAutoClose SetBrandingImage SetCompress SetCompressor SetCompressorDictSize SetCtlColors SetCurInstType SetDatablockOptimize SetDateSave SetDetailsPrint SetDetailsView SetErrorLevel SetErrors SetFileAttributes SetFont SetOutPath SetOverwrite SetPluginUnload SetRebootFlag SetRegView SetShellVarContext SetSilent ShowInstDetails ShowUninstDetails ShowWindow SilentInstall SilentUnInstall Sleep SpaceTexts StrCmp StrCmpS StrCpy StrLen SubCaption SubSectionEnd Unicode UninstallButtonText UninstallCaption UninstallIcon UninstallSubCaption UninstallText UninstPage UnRegDLL Var VIAddVersionKey VIFileVersion VIProductVersion WindowIcon WriteINIStr WriteRegBin WriteRegDWORD WriteRegExpandStr WriteRegStr WriteUninstaller XPStyle',
            literal: 'admin all auto both colored current false force hide highest lastused leave listonly none normal notset off on open print show silent silentlog smooth textonly true user '
        },
        contains: [
            hljs.HASH_COMMENT_MODE,
            hljs.C_BLOCK_COMMENT_MODE, {
                className: 'string',
                begin: '"',
                end: '"',
                illegal: '\\n',
                contains: [{ // $\n, $\r, $\t, $$
                    className: 'symbol',
                    begin: '\\$(\\\\(n|r|t)|\\$)'
                },
                    CONSTANTS,
                    DEFINES,
                    VARIABLES,
                    LANGUAGES
                ]
            }, { // line comments
                className: 'comment',
                begin: ';',
                end: '$',
                relevance: 0
            }, {
                className: 'function',
                beginKeywords: 'Function PageEx Section SectionGroup SubSection',
                end: '$'
            },
            COMPILER,
            DEFINES,
            VARIABLES,
            LANGUAGES,
            PARAMETERS,
            hljs.NUMBER_MODE, { // plug::ins
                className: 'literal',
                begin: hljs.IDENT_RE + '::' + hljs.IDENT_RE
            }
        ]
    };
});
hljs.registerLanguage('objectivec', function (hljs) {
    var OBJC_KEYWORDS = {
        keyword: 'int float while char export sizeof typedef const struct for union ' +
        'unsigned long volatile static bool mutable if do return goto void ' +
        'enum else break extern asm case short default double register explicit ' +
        'signed typename this switch continue wchar_t inline readonly assign ' +
        'readwrite self @synchronized id typeof ' +
        'nonatomic super unichar IBOutlet IBAction strong weak copy ' +
        'in out inout bycopy byref oneway __strong __weak __block __autoreleasing ' +
        '@private @protected @public @try @property @end @throw @catch @finally ' +
        '@autoreleasepool @synthesize @dynamic @selector @optional @required',
        literal: 'false true FALSE TRUE nil YES NO NULL',
        built_in: 'NSString NSData NSDictionary CGRect CGPoint UIButton UILabel UITextView UIWebView MKMapView ' +
        'NSView NSViewController NSWindow NSWindowController NSSet NSUUID NSIndexSet ' +
        'UISegmentedControl NSObject UITableViewDelegate UITableViewDataSource NSThread ' +
        'UIActivityIndicator UITabbar UIToolBar UIBarButtonItem UIImageView NSAutoreleasePool ' +
        'UITableView BOOL NSInteger CGFloat NSException NSLog NSMutableString NSMutableArray ' +
        'NSMutableDictionary NSURL NSIndexPath CGSize UITableViewCell UIView UIViewController ' +
        'UINavigationBar UINavigationController UITabBarController UIPopoverController ' +
        'UIPopoverControllerDelegate UIImage NSNumber UISearchBar NSFetchedResultsController ' +
        'NSFetchedResultsChangeType UIScrollView UIScrollViewDelegate UIEdgeInsets UIColor ' +
        'UIFont UIApplication NSNotFound NSNotificationCenter NSNotification ' +
        'UILocalNotification NSBundle NSFileManager NSTimeInterval NSDate NSCalendar ' +
        'NSUserDefaults UIWindow NSRange NSArray NSError NSURLRequest NSURLConnection ' +
        'NSURLSession NSURLSessionDataTask NSURLSessionDownloadTask NSURLSessionUploadTask NSURLResponse' +
        'UIInterfaceOrientation MPMoviePlayerController dispatch_once_t ' +
        'dispatch_queue_t dispatch_sync dispatch_async dispatch_once'
    };
    var LEXEMES = /[a-zA-Z@][a-zA-Z0-9_]*/;
    var CLASS_KEYWORDS = '@interface @class @protocol @implementation';
    return {
        aliases: ['m', 'mm', 'objc', 'obj-c'],
        keywords: OBJC_KEYWORDS,
        lexemes: LEXEMES,
        illegal: '</',
        contains: [
            hljs.C_LINE_COMMENT_MODE,
            hljs.C_BLOCK_COMMENT_MODE,
            hljs.C_NUMBER_MODE,
            hljs.QUOTE_STRING_MODE, {
                className: 'string',
                variants: [{
                    begin: '@"',
                    end: '"',
                    illegal: '\\n',
                    contains: [hljs.BACKSLASH_ESCAPE]
                }, {
                    begin: '\'',
                    end: '[^\\\\]\'',
                    illegal: '[^\\\\][^\']'
                }]
            }, {
                className: 'preprocessor',
                begin: '#',
                end: '$',
                contains: [{
                    className: 'title',
                    variants: [{
                        begin: '\"',
                        end: '\"'
                    }, {
                        begin: '<',
                        end: '>'
                    }]
                }]
            }, {
                className: 'class',
                begin: '(' + CLASS_KEYWORDS.split(' ').join('|') + ')\\b',
                end: '({|$)',
                excludeEnd: true,
                keywords: CLASS_KEYWORDS,
                lexemes: LEXEMES,
                contains: [
                    hljs.UNDERSCORE_TITLE_MODE
                ]
            }, {
                className: 'variable',
                begin: '\\.' + hljs.UNDERSCORE_IDENT_RE,
                relevance: 0
            }
        ]
    };
});
hljs.registerLanguage('ocaml', function (hljs) {
    /* missing support for heredoc-like string (OCaml 4.0.2+) */
    return {
        aliases: ['ml'],
        keywords: {
            keyword: 'and as assert asr begin class constraint do done downto else end ' +
            'exception external for fun function functor if in include ' +
            'inherit! inherit initializer land lazy let lor lsl lsr lxor match method!|10 method ' +
            'mod module mutable new object of open! open or private rec sig struct ' +
            'then to try type val! val virtual when while with ' +
                /* camlp4 */
            'parser value',
            built_in: /* built-in types */
            'array bool bytes char exn|5 float int int32 int64 list lazy_t|5 nativeint|5 string unit ' +
                /* (some) types in Pervasives */
            'in_channel out_channel ref',
            literal: 'true false'
        },
        illegal: /\/\/|>>/,
        lexemes: '[a-z_]\\w*!?',
        contains: [{
            className: 'literal',
            begin: '\\[(\\|\\|)?\\]|\\(\\)'
        }, {
            className: 'comment',
            begin: '\\(\\*',
            end: '\\*\\)',
            contains: ['self']
        }, {
            /* type variable */
            className: 'symbol',
            begin: '\'[A-Za-z_](?!\')[\\w\']*'
            /* the grammar is ambiguous on how 'a'b should be interpreted but not the compiler */
        }, {
            /* polymorphic variant */
            className: 'tag',
            begin: '`[A-Z][\\w\']*'
        }, {
            /* module or constructor */
            className: 'type',
            begin: '\\b[A-Z][\\w\']*',
            relevance: 0
        }, {
            /* don't color identifiers, but safely catch all identifiers with '*/
            begin: '[a-z_]\\w*\'[\\w\']*'
        },
            hljs.inherit(hljs.APOS_STRING_MODE, {
                className: 'char',
                relevance: 0
            }),
            hljs.inherit(hljs.QUOTE_STRING_MODE, {
                illegal: null
            }), {
                className: 'number',
                begin: '\\b(0[xX][a-fA-F0-9_]+[Lln]?|' +
                '0[oO][0-7_]+[Lln]?|' +
                '0[bB][01_]+[Lln]?|' +
                '[0-9][0-9_]*([Lln]|(\\.[0-9_]*)?([eE][-+]?[0-9_]+)?)?)',
                relevance: 0
            }, {
                begin: /[-=]>/ // relevance booster
            }
        ]
    }
});
hljs.registerLanguage('oxygene', function (hljs) {
    var OXYGENE_KEYWORDS = 'abstract add and array as asc aspect assembly async begin break block by case class concat const copy constructor continue ' +
        'create default delegate desc distinct div do downto dynamic each else empty end ensure enum equals event except exit extension external false ' +
        'final finalize finalizer finally flags for forward from function future global group has if implementation implements implies in index inherited ' +
        'inline interface into invariants is iterator join locked locking loop matching method mod module namespace nested new nil not notify nullable of ' +
        'old on operator or order out override parallel params partial pinned private procedure property protected public queryable raise read readonly ' +
        'record reintroduce remove repeat require result reverse sealed select self sequence set shl shr skip static step soft take then to true try tuple ' +
        'type union unit unsafe until uses using var virtual raises volatile where while with write xor yield await mapped deprecated stdcall cdecl pascal ' +
        'register safecall overload library platform reference packed strict published autoreleasepool selector strong weak unretained';
    var CURLY_COMMENT = {
        className: 'comment',
        begin: '{',
        end: '}',
        relevance: 0
    };
    var PAREN_COMMENT = {
        className: 'comment',
        begin: '\\(\\*',
        end: '\\*\\)',
        relevance: 10
    };
    var STRING = {
        className: 'string',
        begin: '\'',
        end: '\'',
        contains: [{
            begin: '\'\''
        }]
    };
    var CHAR_STRING = {
        className: 'string',
        begin: '(#\\d+)+'
    };
    var FUNCTION = {
        className: 'function',
        beginKeywords: 'function constructor destructor procedure method',
        end: '[:;]',
        keywords: 'function constructor|10 destructor|10 procedure|10 method|10',
        contains: [
            hljs.TITLE_MODE, {
                className: 'params',
                begin: '\\(',
                end: '\\)',
                keywords: OXYGENE_KEYWORDS,
                contains: [STRING, CHAR_STRING]
            },
            CURLY_COMMENT, PAREN_COMMENT
        ]
    };
    return {
        case_insensitive: true,
        keywords: OXYGENE_KEYWORDS,
        illegal: '("|\\$[G-Zg-z]|\\/\\*|</|=>|->)',
        contains: [
            CURLY_COMMENT, PAREN_COMMENT, hljs.C_LINE_COMMENT_MODE,
            STRING, CHAR_STRING,
            hljs.NUMBER_MODE,
            FUNCTION, {
                className: 'class',
                begin: '=\\bclass\\b',
                end: 'end;',
                keywords: OXYGENE_KEYWORDS,
                contains: [
                    STRING, CHAR_STRING,
                    CURLY_COMMENT, PAREN_COMMENT, hljs.C_LINE_COMMENT_MODE,
                    FUNCTION
                ]
            }
        ]
    };
});
hljs.registerLanguage('parser3', function (hljs) {
    return {
        subLanguage: 'xml',
        relevance: 0,
        contains: [{
            className: 'comment',
            begin: '^#',
            end: '$'
        }, {
            className: 'comment',
            begin: '\\^rem{',
            end: '}',
            relevance: 10,
            contains: [{
                begin: '{',
                end: '}',
                contains: ['self']
            }]
        }, {
            className: 'preprocessor',
            begin: '^@(?:BASE|USE|CLASS|OPTIONS)$',
            relevance: 10
        }, {
            className: 'title',
            begin: '@[\\w\\-]+\\[[\\w^;\\-]*\\](?:\\[[\\w^;\\-]*\\])?(?:.*)$'
        }, {
            className: 'variable',
            begin: '\\$\\{?[\\w\\-\\.\\:]+\\}?'
        }, {
            className: 'keyword',
            begin: '\\^[\\w\\-\\.\\:]+'
        }, {
            className: 'number',
            begin: '\\^#[0-9a-fA-F]+'
        },
            hljs.C_NUMBER_MODE
        ]
    };
});
hljs.registerLanguage('perl', function (hljs) {
    var PERL_KEYWORDS = 'getpwent getservent quotemeta msgrcv scalar kill dbmclose undef lc ' +
        'ma syswrite tr send umask sysopen shmwrite vec qx utime local oct semctl localtime ' +
        'readpipe do return format read sprintf dbmopen pop getpgrp not getpwnam rewinddir qq' +
        'fileno qw endprotoent wait sethostent bless s|0 opendir continue each sleep endgrent ' +
        'shutdown dump chomp connect getsockname die socketpair close flock exists index shmget' +
        'sub for endpwent redo lstat msgctl setpgrp abs exit select print ref gethostbyaddr ' +
        'unshift fcntl syscall goto getnetbyaddr join gmtime symlink semget splice x|0 ' +
        'getpeername recv log setsockopt cos last reverse gethostbyname getgrnam study formline ' +
        'endhostent times chop length gethostent getnetent pack getprotoent getservbyname rand ' +
        'mkdir pos chmod y|0 substr endnetent printf next open msgsnd readdir use unlink ' +
        'getsockopt getpriority rindex wantarray hex system getservbyport endservent int chr ' +
        'untie rmdir prototype tell listen fork shmread ucfirst setprotoent else sysseek link ' +
        'getgrgid shmctl waitpid unpack getnetbyname reset chdir grep split require caller ' +
        'lcfirst until warn while values shift telldir getpwuid my getprotobynumber delete and ' +
        'sort uc defined srand accept package seekdir getprotobyname semop our rename seek if q|0 ' +
        'chroot sysread setpwent no crypt getc chown sqrt write setnetent setpriority foreach ' +
        'tie sin msgget map stat getlogin unless elsif truncate exec keys glob tied closedir' +
        'ioctl socket readlink eval xor readline binmode setservent eof ord bind alarm pipe ' +
        'atan2 getgrent exp time push setgrent gt lt or ne m|0 break given say state when';
    var SUBST = {
        className: 'subst',
        begin: '[$@]\\{',
        end: '\\}',
        keywords: PERL_KEYWORDS
    };
    var METHOD = {
        begin: '->{',
        end: '}'
        // contains defined later
    };
    var VAR = {
        className: 'variable',
        variants: [{
            begin: /\$\d/
        }, {
            begin: /[\$%@](\^\w\b|#\w+(::\w+)*|{\w+}|\w+(::\w*)*)/
        }, {
            begin: /[\$%@][^\s\w{]/,
            relevance: 0
        }]
    };
    var COMMENT = {
        className: 'comment',
        begin: '^(__END__|__DATA__)',
        end: '\\n$',
        relevance: 5
    };
    var STRING_CONTAINS = [hljs.BACKSLASH_ESCAPE, SUBST, VAR];
    var PERL_DEFAULT_CONTAINS = [
        VAR,
        hljs.HASH_COMMENT_MODE,
        COMMENT, {
            className: 'comment',
            begin: '^\\=\\w',
            end: '\\=cut',
            endsWithParent: true
        },
        METHOD, {
            className: 'string',
            contains: STRING_CONTAINS,
            variants: [{
                begin: 'q[qwxr]?\\s*\\(',
                end: '\\)',
                relevance: 5
            }, {
                begin: 'q[qwxr]?\\s*\\[',
                end: '\\]',
                relevance: 5
            }, {
                begin: 'q[qwxr]?\\s*\\{',
                end: '\\}',
                relevance: 5
            }, {
                begin: 'q[qwxr]?\\s*\\|',
                end: '\\|',
                relevance: 5
            }, {
                begin: 'q[qwxr]?\\s*\\<',
                end: '\\>',
                relevance: 5
            }, {
                begin: 'qw\\s+q',
                end: 'q',
                relevance: 5
            }, {
                begin: '\'',
                end: '\'',
                contains: [hljs.BACKSLASH_ESCAPE]
            }, {
                begin: '"',
                end: '"'
            }, {
                begin: '`',
                end: '`',
                contains: [hljs.BACKSLASH_ESCAPE]
            }, {
                begin: '{\\w+}',
                contains: [],
                relevance: 0
            }, {
                begin: '\-?\\w+\\s*\\=\\>',
                contains: [],
                relevance: 0
            }]
        }, {
            className: 'number',
            begin: '(\\b0[0-7_]+)|(\\b0x[0-9a-fA-F_]+)|(\\b[1-9][0-9_]*(\\.[0-9_]+)?)|[0_]\\b',
            relevance: 0
        }, { // regexp container
            begin: '(\\/\\/|' + hljs.RE_STARTERS_RE + '|\\b(split|return|print|reverse|grep)\\b)\\s*',
            keywords: 'split return print reverse grep',
            relevance: 0,
            contains: [
                hljs.HASH_COMMENT_MODE,
                COMMENT, {
                    className: 'regexp',
                    begin: '(s|tr|y)/(\\\\.|[^/])*/(\\\\.|[^/])*/[a-z]*',
                    relevance: 10
                }, {
                    className: 'regexp',
                    begin: '(m|qr)?/',
                    end: '/[a-z]*',
                    contains: [hljs.BACKSLASH_ESCAPE],
                    relevance: 0 // allows empty "//" which is a common comment delimiter in other languages
                }
            ]
        }, {
            className: 'sub',
            beginKeywords: 'sub',
            end: '(\\s*\\(.*?\\))?[;{]',
            relevance: 5
        }, {
            className: 'operator',
            begin: '-\\w\\b',
            relevance: 0
        }
    ];
    SUBST.contains = PERL_DEFAULT_CONTAINS;
    METHOD.contains = PERL_DEFAULT_CONTAINS;

    return {
        aliases: ['pl'],
        keywords: PERL_KEYWORDS,
        contains: PERL_DEFAULT_CONTAINS
    };
});
hljs.registerLanguage('pf', function (hljs) {
    var MACRO = {
        className: 'variable',
        begin: /\$[\w\d#@][\w\d_]*/
    };
    var TABLE = {
        className: 'variable',
        begin: /</,
        end: />/
    };
    var QUOTE_STRING = {
        className: 'string',
        begin: /"/,
        end: /"/
    };

    return {
        aliases: ['pf.conf'],
        lexemes: /[a-z0-9_<>-]+/,
        keywords: {
            built_in: /* block match pass are "actions" in pf.conf(5), the rest are
             * lexically similar top-level commands.
             */
                'block match pass load anchor|5 antispoof|10 set table',
            keyword: 'in out log quick on rdomain inet inet6 proto from port os to route' +
            'allow-opts divert-packet divert-reply divert-to flags group icmp-type' +
            'icmp6-type label once probability recieved-on rtable prio queue' +
            'tos tag tagged user keep fragment for os drop' +
            'af-to|10 binat-to|10 nat-to|10 rdr-to|10 bitmask least-stats random round-robin' +
            'source-hash static-port' +
            'dup-to reply-to route-to' +
            'parent bandwidth default min max qlimit' +
            'block-policy debug fingerprints hostid limit loginterface optimization' +
            'reassemble ruleset-optimization basic none profile skip state-defaults' +
            'state-policy timeout' +
            'const counters persist' +
            'no modulate synproxy state|5 floating if-bound no-sync pflow|10 sloppy' +
            'source-track global rule max-src-nodes max-src-states max-src-conn' +
            'max-src-conn-rate overload flush' +
            'scrub|5 max-mss min-ttl no-df|10 random-id',
            literal: 'all any no-route self urpf-failed egress|5 unknown'
        },
        contains: [
            hljs.HASH_COMMENT_MODE,
            hljs.NUMBER_MODE,
            hljs.QUOTE_STRING_MODE,
            MACRO,
            TABLE
        ]
    };
});
hljs.registerLanguage('php', function (hljs) {
    var VARIABLE = {
        className: 'variable',
        begin: '\\$+[a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*'
    };
    var PREPROCESSOR = {
        className: 'preprocessor',
        begin: /<\?(php)?|\?>/
    };
    var STRING = {
        className: 'string',
        contains: [hljs.BACKSLASH_ESCAPE, PREPROCESSOR],
        variants: [{
            begin: 'b"',
            end: '"'
        }, {
            begin: 'b\'',
            end: '\''
        },
            hljs.inherit(hljs.APOS_STRING_MODE, {
                illegal: null
            }),
            hljs.inherit(hljs.QUOTE_STRING_MODE, {
                illegal: null
            })
        ]
    };
    var NUMBER = {
        variants: [hljs.BINARY_NUMBER_MODE, hljs.C_NUMBER_MODE]
    };
    return {
        aliases: ['php3', 'php4', 'php5', 'php6'],
        case_insensitive: true,
        keywords: 'and include_once list abstract global private echo interface as static endswitch ' +
        'array null if endwhile or const for endforeach self var while isset public ' +
        'protected exit foreach throw elseif include __FILE__ empty require_once do xor ' +
        'return parent clone use __CLASS__ __LINE__ else break print eval new ' +
        'catch __METHOD__ case exception default die require __FUNCTION__ ' +
        'enddeclare final try switch continue endfor endif declare unset true false ' +
        'trait goto instanceof insteadof __DIR__ __NAMESPACE__ ' +
        'yield finally',
        contains: [
            hljs.C_LINE_COMMENT_MODE,
            hljs.HASH_COMMENT_MODE, {
                className: 'comment',
                begin: '/\\*',
                end: '\\*/',
                contains: [{
                    className: 'phpdoc',
                    begin: '\\s@[A-Za-z]+'
                },
                    PREPROCESSOR
                ]
            }, {
                className: 'comment',
                begin: '__halt_compiler.+?;',
                endsWithParent: true,
                keywords: '__halt_compiler',
                lexemes: hljs.UNDERSCORE_IDENT_RE
            }, {
                className: 'string',
                begin: '<<<[\'"]?\\w+[\'"]?$',
                end: '^\\w+;',
                contains: [hljs.BACKSLASH_ESCAPE]
            },
            PREPROCESSOR,
            VARIABLE, {
                // swallow class members to avoid parsing them as keywords
                begin: /->+[a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*/
            }, {
                className: 'function',
                beginKeywords: 'function',
                end: /[;{]/,
                excludeEnd: true,
                illegal: '\\$|\\[|%',
                contains: [
                    hljs.UNDERSCORE_TITLE_MODE, {
                        className: 'params',
                        begin: '\\(',
                        end: '\\)',
                        contains: [
                            'self',
                            VARIABLE,
                            hljs.C_BLOCK_COMMENT_MODE,
                            STRING,
                            NUMBER
                        ]
                    }
                ]
            }, {
                className: 'class',
                beginKeywords: 'class interface',
                end: '{',
                excludeEnd: true,
                illegal: /[:\(\$"]/,
                contains: [{
                    beginKeywords: 'extends implements'
                },
                    hljs.UNDERSCORE_TITLE_MODE
                ]
            }, {
                beginKeywords: 'namespace',
                end: ';',
                illegal: /[\.']/,
                contains: [hljs.UNDERSCORE_TITLE_MODE]
            }, {
                beginKeywords: 'use',
                end: ';',
                contains: [hljs.UNDERSCORE_TITLE_MODE]
            }, {
                begin: '=>' // No markup, just a relevance booster
            },
            STRING,
            NUMBER
        ]
    };
});
hljs.registerLanguage('powershell', function (hljs) {
    var backtickEscape = {
        begin: '`[\\s\\S]',
        relevance: 0
    };
    var dollarEscape = {
        begin: '\\$\\$[\\s\\S]',
        relevance: 0
    };
    var VAR = {
        className: 'variable',
        variants: [{
            begin: /\$[\w\d][\w\d_:]*/
        }]
    };
    var QUOTE_STRING = {
        className: 'string',
        begin: /"/,
        end: /"/,
        contains: [
            backtickEscape,
            VAR, {
                className: 'variable',
                begin: /\$[A-z]/,
                end: /[^A-z]/
            }
        ]
    };
    var APOS_STRING = {
        className: 'string',
        begin: /'/,
        end: /'/
    };

    return {
        aliases: ['ps'],
        lexemes: /-?[A-z\.\-]+/,
        case_insensitive: true,
        keywords: {
            keyword: 'if else foreach return function do while until elseif begin for trap data dynamicparam end break throw param continue finally in switch exit filter try process catch',
            literal: '$null $true $false',
            built_in: 'Add-Content Add-History Add-Member Add-PSSnapin Clear-Content Clear-Item Clear-Item Property Clear-Variable Compare-Object ConvertFrom-SecureString Convert-Path ConvertTo-Html ConvertTo-SecureString Copy-Item Copy-ItemProperty Export-Alias Export-Clixml Export-Console Export-Csv ForEach-Object Format-Custom Format-List Format-Table Format-Wide Get-Acl Get-Alias Get-AuthenticodeSignature Get-ChildItem Get-Command Get-Content Get-Credential Get-Culture Get-Date Get-EventLog Get-ExecutionPolicy Get-Help Get-History Get-Host Get-Item Get-ItemProperty Get-Location Get-Member Get-PfxCertificate Get-Process Get-PSDrive Get-PSProvider Get-PSSnapin Get-Service Get-TraceSource Get-UICulture Get-Unique Get-Variable Get-WmiObject Group-Object Import-Alias Import-Clixml Import-Csv Invoke-Expression Invoke-History Invoke-Item Join-Path Measure-Command Measure-Object Move-Item Move-ItemProperty New-Alias New-Item New-ItemProperty New-Object New-PSDrive New-Service New-TimeSpan New-Variable Out-Default Out-File Out-Host Out-Null Out-Printer Out-String Pop-Location Push-Location Read-Host Remove-Item Remove-ItemProperty Remove-PSDrive Remove-PSSnapin Remove-Variable Rename-Item Rename-ItemProperty Resolve-Path Restart-Service Resume-Service Select-Object Select-String Set-Acl Set-Alias Set-AuthenticodeSignature Set-Content Set-Date Set-ExecutionPolicy Set-Item Set-ItemProperty Set-Location Set-PSDebug Set-Service Set-TraceSource Set-Variable Sort-Object Split-Path Start-Service Start-Sleep Start-Transcript Stop-Process Stop-Service Stop-Transcript Suspend-Service Tee-Object Test-Path Trace-Command Update-FormatData Update-TypeData Where-Object Write-Debug Write-Error Write-Host Write-Output Write-Progress Write-Verbose Write-Warning',
            operator: '-ne -eq -lt -gt -ge -le -not -like -notlike -match -notmatch -contains -notcontains -in -notin -replace'
        },
        contains: [
            hljs.HASH_COMMENT_MODE,
            hljs.NUMBER_MODE,
            QUOTE_STRING,
            APOS_STRING,
            VAR
        ]
    };
});
hljs.registerLanguage('processing', function (hljs) {
    return {
        keywords: {
            keyword: 'BufferedReader PVector PFont PImage PGraphics HashMap boolean byte char color ' +
            'double float int long String Array FloatDict FloatList IntDict IntList JSONArray JSONObject ' +
            'Object StringDict StringList Table TableRow XML ' +
                // Java keywords
            'false synchronized int abstract float private char boolean static null if const ' +
            'for true while long throw strictfp finally protected import native final return void ' +
            'enum else break transient new catch instanceof byte super volatile case assert short ' +
            'package default double public try this switch continue throws protected public private',
            constant: 'P2D P3D HALF_PI PI QUARTER_PI TAU TWO_PI',
            variable: 'displayHeight displayWidth mouseY mouseX mousePressed pmouseX pmouseY key ' +
            'keyCode pixels focused frameCount frameRate height width',
            title: 'setup draw',
            built_in: 'size createGraphics beginDraw createShape loadShape PShape arc ellipse line point ' +
            'quad rect triangle bezier bezierDetail bezierPoint bezierTangent curve curveDetail curvePoint ' +
            'curveTangent curveTightness shape shapeMode beginContour beginShape bezierVertex curveVertex ' +
            'endContour endShape quadraticVertex vertex ellipseMode noSmooth rectMode smooth strokeCap ' +
            'strokeJoin strokeWeight mouseClicked mouseDragged mouseMoved mousePressed mouseReleased ' +
            'mouseWheel keyPressed keyPressedkeyReleased keyTyped print println save saveFrame day hour ' +
            'millis minute month second year background clear colorMode fill noFill noStroke stroke alpha ' +
            'blue brightness color green hue lerpColor red saturation modelX modelY modelZ screenX screenY ' +
            'screenZ ambient emissive shininess specular add createImage beginCamera camera endCamera frustum ' +
            'ortho perspective printCamera printProjection cursor frameRate noCursor exit loop noLoop popStyle ' +
            'pushStyle redraw binary boolean byte char float hex int str unbinary unhex join match matchAll nf ' +
            'nfc nfp nfs split splitTokens trim append arrayCopy concat expand reverse shorten sort splice subset ' +
            'box sphere sphereDetail createInput createReader loadBytes loadJSONArray loadJSONObject loadStrings ' +
            'loadTable loadXML open parseXML saveTable selectFolder selectInput beginRaw beginRecord createOutput ' +
            'createWriter endRaw endRecord PrintWritersaveBytes saveJSONArray saveJSONObject saveStream saveStrings ' +
            'saveXML selectOutput popMatrix printMatrix pushMatrix resetMatrix rotate rotateX rotateY rotateZ scale ' +
            'shearX shearY translate ambientLight directionalLight lightFalloff lights lightSpecular noLights normal ' +
            'pointLight spotLight image imageMode loadImage noTint requestImage tint texture textureMode textureWrap ' +
            'blend copy filter get loadPixels set updatePixels blendMode loadShader PShaderresetShader shader createFont ' +
            'loadFont text textFont textAlign textLeading textMode textSize textWidth textAscent textDescent abs ceil ' +
            'constrain dist exp floor lerp log mag map max min norm pow round sq sqrt acos asin atan atan2 cos degrees ' +
            'radians sin tan noise noiseDetail noiseSeed random randomGaussian randomSeed'
        },
        contains: [
            hljs.C_LINE_COMMENT_MODE,
            hljs.C_BLOCK_COMMENT_MODE,
            hljs.APOS_STRING_MODE,
            hljs.QUOTE_STRING_MODE,
            hljs.C_NUMBER_MODE
        ]
    };
});
hljs.registerLanguage('profile', function (hljs) {
    return {
        contains: [
            hljs.C_NUMBER_MODE, {
                className: 'built_in',
                begin: '{',
                end: '}$',
                excludeBegin: true,
                excludeEnd: true,
                contains: [hljs.APOS_STRING_MODE, hljs.QUOTE_STRING_MODE],
                relevance: 0
            }, {
                className: 'filename',
                begin: '[a-zA-Z_][\\da-zA-Z_]+\\.[\\da-zA-Z_]{1,3}',
                end: ':',
                excludeEnd: true
            }, {
                className: 'header',
                begin: '(ncalls|tottime|cumtime)',
                end: '$',
                keywords: 'ncalls tottime|10 cumtime|10 filename',
                relevance: 10
            }, {
                className: 'summary',
                begin: 'function calls',
                end: '$',
                contains: [hljs.C_NUMBER_MODE],
                relevance: 10
            },
            hljs.APOS_STRING_MODE,
            hljs.QUOTE_STRING_MODE, {
                className: 'function',
                begin: '\\(',
                end: '\\)$',
                contains: [
                    hljs.UNDERSCORE_TITLE_MODE
                ],
                relevance: 0
            }
        ]
    };
});
hljs.registerLanguage('protobuf', function (hljs) {
    return {
        keywords: {
            keyword: 'package import option optional required repeated group',
            built_in: 'double float int32 int64 uint32 uint64 sint32 sint64 ' +
            'fixed32 fixed64 sfixed32 sfixed64 bool string bytes',
            literal: 'true false'
        },
        contains: [
            hljs.QUOTE_STRING_MODE,
            hljs.NUMBER_MODE,
            hljs.C_LINE_COMMENT_MODE, {
                className: 'class',
                beginKeywords: 'message enum service',
                end: /\{/,
                illegal: /\n/,
                contains: [
                    hljs.inherit(hljs.TITLE_MODE, {
                        starts: {
                            endsWithParent: true,
                            excludeEnd: true
                        } // hack: eating everything after the first title
                    })
                ]
            }, {
                className: 'function',
                beginKeywords: 'rpc',
                end: /;/,
                excludeEnd: true,
                keywords: 'rpc returns'
            }, {
                className: 'constant',
                begin: /^\s*[A-Z_]+/,
                end: /\s*=/,
                excludeEnd: true
            }
        ]
    };
});
hljs.registerLanguage('puppet', function (hljs) {
    var PUPPET_TYPE_REFERENCE =
        'augeas computer cron exec file filebucket host interface k5login macauthorization mailalias maillist mcx mount nagios_command ' +
        'nagios_contact nagios_contactgroup nagios_host nagios_hostdependency nagios_hostescalation nagios_hostextinfo nagios_hostgroup nagios_service firewall ' +
        'nagios_servicedependency nagios_serviceescalation nagios_serviceextinfo nagios_servicegroup nagios_timeperiod notify package resources ' +
        'router schedule scheduled_task selboolean selmodule service ssh_authorized_key sshkey stage tidy user vlan yumrepo zfs zone zpool';

    var PUPPET_ATTRIBUTES =
        /* metaparameters */
        'alias audit before loglevel noop require subscribe tag ' +
            /* normal attributes */
        'owner ensure group mode name|0 changes context force incl lens load_path onlyif provider returns root show_diff type_check ' +
        'en_address ip_address realname command environment hour monute month monthday special target weekday ' +
        'creates cwd ogoutput refresh refreshonly tries try_sleep umask backup checksum content ctime force ignore ' +
        'links mtime purge recurse recurselimit replace selinux_ignore_defaults selrange selrole seltype seluser source ' +
        'souirce_permissions sourceselect validate_cmd validate_replacement allowdupe attribute_membership auth_membership forcelocal gid ' +
        'ia_load_module members system host_aliases ip allowed_trunk_vlans description device_url duplex encapsulation etherchannel ' +
        'native_vlan speed principals allow_root auth_class auth_type authenticate_user k_of_n mechanisms rule session_owner shared options ' +
        'device fstype enable hasrestart directory present absent link atboot blockdevice device dump pass remounts poller_tag use ' +
        'message withpath adminfile allow_virtual allowcdrom category configfiles flavor install_options instance package_settings platform ' +
        'responsefile status uninstall_options vendor unless_system_user unless_uid binary control flags hasstatus manifest pattern restart running ' +
        'start stop allowdupe auths expiry gid groups home iterations key_membership keys managehome membership password password_max_age ' +
        'password_min_age profile_membership profiles project purge_ssh_keys role_membership roles salt shell uid baseurl cost descr enabled ' +
        'enablegroups exclude failovermethod gpgcheck gpgkey http_caching include includepkgs keepalive metadata_expire metalink mirrorlist ' +
        'priority protect proxy proxy_password proxy_username repo_gpgcheck s3_enabled skip_if_unavailable sslcacert sslclientcert sslclientkey ' +
        'sslverify mounted';

    var PUPPET_KEYWORDS = {
        keyword: /* language keywords */
        'and case class default define else elsif false if in import enherits node or true undef unless main settings $string ' + PUPPET_TYPE_REFERENCE,
        literal: PUPPET_ATTRIBUTES,

        built_in: /* core facts */
        'architecture augeasversion blockdevices boardmanufacturer boardproductname boardserialnumber cfkey dhcp_servers ' +
        'domain ec2_ ec2_userdata facterversion filesystems ldom fqdn gid hardwareisa hardwaremodel hostname id|0 interfaces ' +
        'ipaddress ipaddress_ ipaddress6 ipaddress6_ iphostnumber is_virtual kernel kernelmajversion kernelrelease kernelversion ' +
        'kernelrelease kernelversion lsbdistcodename lsbdistdescription lsbdistid lsbdistrelease lsbmajdistrelease lsbminordistrelease ' +
        'lsbrelease macaddress macaddress_ macosx_buildversion macosx_productname macosx_productversion macosx_productverson_major ' +
        'macosx_productversion_minor manufacturer memoryfree memorysize netmask metmask_ network_ operatingsystem operatingsystemmajrelease ' +
        'operatingsystemrelease osfamily partitions path physicalprocessorcount processor processorcount productname ps puppetversion ' +
        'rubysitedir rubyversion selinux selinux_config_mode selinux_config_policy selinux_current_mode selinux_current_mode selinux_enforced ' +
        'selinux_policyversion serialnumber sp_ sshdsakey sshecdsakey sshrsakey swapencrypted swapfree swapsize timezone type uniqueid uptime ' +
        'uptime_days uptime_hours uptime_seconds uuid virtual vlans xendomains zfs_version zonenae zones zpool_version'
    };

    var COMMENT = {
        className: 'comment',
        begin: '#',
        end: '$'
    };

    var STRING = {
        className: 'string',
        contains: [hljs.BACKSLASH_ESCAPE],
        variants: [{
            begin: /'/,
            end: /'/
        }, {
            begin: /"/,
            end: /"/
        }]
    };

    var PUPPET_DEFAULT_CONTAINS = [
        STRING,
        COMMENT, {
            className: 'keyword',
            beginKeywords: 'class',
            end: '$|;',
            illegal: /=/,
            contains: [
                hljs.inherit(hljs.TITLE_MODE, {
                    begin: '(::)?[A-Za-z_]\\w*(::\\w+)*'
                }),
                COMMENT,
                STRING
            ]
        }, {
            className: 'keyword',
            begin: '([a-zA-Z_(::)]+ *\\{)',
            contains: [STRING, COMMENT],
            relevance: 0
        }, {
            className: 'keyword',
            begin: '(\\}|\\{)',
            relevance: 0
        }, {
            className: 'function',
            begin: '[a-zA-Z_]+\\s*=>'
        }, {
            className: 'constant',
            begin: '(::)?(\\b[A-Z][a-z_]*(::)?)+',
            relevance: 0
        }, {
            className: 'number',
            begin: '(\\b0[0-7_]+)|(\\b0x[0-9a-fA-F_]+)|(\\b[1-9][0-9_]*(\\.[0-9_]+)?)|[0_]\\b',
            relevance: 0
        }
    ];

    return {
        aliases: ['pp'],
        keywords: PUPPET_KEYWORDS,
        contains: PUPPET_DEFAULT_CONTAINS
    }
});
hljs.registerLanguage('python', function (hljs) {
    var PROMPT = {
        className: 'prompt',
        begin: /^(>>>|\.\.\.) /
    };
    var STRING = {
        className: 'string',
        contains: [hljs.BACKSLASH_ESCAPE],
        variants: [{
            begin: /(u|b)?r?'''/,
            end: /'''/,
            contains: [PROMPT],
            relevance: 10
        }, {
            begin: /(u|b)?r?"""/,
            end: /"""/,
            contains: [PROMPT],
            relevance: 10
        }, {
            begin: /(u|r|ur)'/,
            end: /'/,
            relevance: 10
        }, {
            begin: /(u|r|ur)"/,
            end: /"/,
            relevance: 10
        }, {
            begin: /(b|br)'/,
            end: /'/
        }, {
            begin: /(b|br)"/,
            end: /"/
        },
            hljs.APOS_STRING_MODE,
            hljs.QUOTE_STRING_MODE
        ]
    };
    var NUMBER = {
        className: 'number',
        relevance: 0,
        variants: [{
            begin: hljs.BINARY_NUMBER_RE + '[lLjJ]?'
        }, {
            begin: '\\b(0o[0-7]+)[lLjJ]?'
        }, {
            begin: hljs.C_NUMBER_RE + '[lLjJ]?'
        }]
    };
    var PARAMS = {
        className: 'params',
        begin: /\(/,
        end: /\)/,
        contains: ['self', PROMPT, NUMBER, STRING]
    };
    return {
        aliases: ['py', 'gyp'],
        keywords: {
            keyword: 'and elif is global as in if from raise for except finally print import pass return ' +
            'exec else break not with class assert yield try while continue del or def lambda ' +
            'nonlocal|10 None True False',
            built_in: 'Ellipsis NotImplemented'
        },
        illegal: /(<\/|->|\?)/,
        contains: [
            PROMPT,
            NUMBER,
            STRING,
            hljs.HASH_COMMENT_MODE, {
                variants: [{
                    className: 'function',
                    beginKeywords: 'def',
                    relevance: 10
                }, {
                    className: 'class',
                    beginKeywords: 'class'
                }],
                end: /:/,
                illegal: /[${=;\n]/,
                contains: [hljs.UNDERSCORE_TITLE_MODE, PARAMS]
            }, {
                className: 'decorator',
                begin: /@/,
                end: /$/
            }, {
                begin: /\b(print|exec)\(/ // don’t highlight keywords-turned-functions in Python 3
            }
        ]
    };
});
hljs.registerLanguage('q', function (hljs) {
    var Q_KEYWORDS = {
        keyword: 'do while select delete by update from',
        constant: '0b 1b',
        built_in: 'neg not null string reciprocal floor ceiling signum mod xbar xlog and or each scan over prior mmu lsq inv md5 ltime gtime count first var dev med cov cor all any rand sums prds mins maxs fills deltas ratios avgs differ prev next rank reverse iasc idesc asc desc msum mcount mavg mdev xrank mmin mmax xprev rotate distinct group where flip type key til get value attr cut set upsert raze union inter except cross sv vs sublist enlist read0 read1 hopen hclose hdel hsym hcount peach system ltrim rtrim trim lower upper ssr view tables views cols xcols keys xkey xcol xasc xdesc fkeys meta lj aj aj0 ij pj asof uj ww wj wj1 fby xgroup ungroup ej save load rsave rload show csv parse eval min max avg wavg wsum sin cos tan sum',
        typename: '`float `double int `timestamp `timespan `datetime `time `boolean `symbol `char `byte `short `long `real `month `date `minute `second `guid'
    };
    return {
        aliases: ['k', 'kdb'],
        keywords: Q_KEYWORDS,
        lexemes: /\b(`?)[A-Za-z0-9_]+\b/,
        contains: [
            hljs.C_LINE_COMMENT_MODE,
            hljs.QUOTE_STRING_MODE,
            hljs.C_NUMBER_MODE
        ]
    };
});
hljs.registerLanguage('r', function (hljs) {
    var IDENT_RE = '([a-zA-Z]|\\.[a-zA-Z.])[a-zA-Z0-9._]*';

    return {
        contains: [
            hljs.HASH_COMMENT_MODE, {
                begin: IDENT_RE,
                lexemes: IDENT_RE,
                keywords: {
                    keyword: 'function if in break next repeat else for return switch while try tryCatch|10 ' +
                    'stop warning require library attach detach source setMethod setGeneric ' +
                    'setGroupGeneric setClass ...|10',
                    literal: 'NULL NA TRUE FALSE T F Inf NaN NA_integer_|10 NA_real_|10 NA_character_|10 ' +
                    'NA_complex_|10'
                },
                relevance: 0
            }, {
                // hex value
                className: 'number',
                begin: "0[xX][0-9a-fA-F]+[Li]?\\b",
                relevance: 0
            }, {
                // explicit integer
                className: 'number',
                begin: "\\d+(?:[eE][+\\-]?\\d*)?L\\b",
                relevance: 0
            }, {
                // number with trailing decimal
                className: 'number',
                begin: "\\d+\\.(?!\\d)(?:i\\b)?",
                relevance: 0
            }, {
                // number
                className: 'number',
                begin: "\\d+(?:\\.\\d*)?(?:[eE][+\\-]?\\d*)?i?\\b",
                relevance: 0
            }, {
                // number with leading decimal
                className: 'number',
                begin: "\\.\\d+(?:[eE][+\\-]?\\d*)?i?\\b",
                relevance: 0
            },

            {
                // escaped identifier
                begin: '`',
                end: '`',
                relevance: 0
            },

            {
                className: 'string',
                contains: [hljs.BACKSLASH_ESCAPE],
                variants: [{
                    begin: '"',
                    end: '"'
                }, {
                    begin: "'",
                    end: "'"
                }]
            }
        ]
    };
});
hljs.registerLanguage('rib', function (hljs) {
    return {
        keywords: 'ArchiveRecord AreaLightSource Atmosphere Attribute AttributeBegin AttributeEnd Basis ' +
        'Begin Blobby Bound Clipping ClippingPlane Color ColorSamples ConcatTransform Cone ' +
        'CoordinateSystem CoordSysTransform CropWindow Curves Cylinder DepthOfField Detail ' +
        'DetailRange Disk Displacement Display End ErrorHandler Exposure Exterior Format ' +
        'FrameAspectRatio FrameBegin FrameEnd GeneralPolygon GeometricApproximation Geometry ' +
        'Hider Hyperboloid Identity Illuminate Imager Interior LightSource ' +
        'MakeCubeFaceEnvironment MakeLatLongEnvironment MakeShadow MakeTexture Matte ' +
        'MotionBegin MotionEnd NuPatch ObjectBegin ObjectEnd ObjectInstance Opacity Option ' +
        'Orientation Paraboloid Patch PatchMesh Perspective PixelFilter PixelSamples ' +
        'PixelVariance Points PointsGeneralPolygons PointsPolygons Polygon Procedural Projection ' +
        'Quantize ReadArchive RelativeDetail ReverseOrientation Rotate Scale ScreenWindow ' +
        'ShadingInterpolation ShadingRate Shutter Sides Skew SolidBegin SolidEnd Sphere ' +
        'SubdivisionMesh Surface TextureCoordinates Torus Transform TransformBegin TransformEnd ' +
        'TransformPoints Translate TrimCurve WorldBegin WorldEnd',
        illegal: '</',
        contains: [
            hljs.HASH_COMMENT_MODE,
            hljs.C_NUMBER_MODE,
            hljs.APOS_STRING_MODE,
            hljs.QUOTE_STRING_MODE
        ]
    };
});
hljs.registerLanguage('roboconf', function (hljs) {
    var IDENTIFIER = '[a-zA-Z-_][^\n{\r\n]+\\{';

    return {
        aliases: ['graph', 'instances'],
        case_insensitive: true,
        keywords: 'import',
        contains: [
            // Facet sections
            {
                className: 'facet',
                begin: '^facet ' + IDENTIFIER,
                end: '}',
                keywords: 'facet installer exports children extends',
                contains: [
                    hljs.HASH_COMMENT_MODE
                ]
            },

            // Instance sections
            {
                className: 'instance-of',
                begin: '^instance of ' + IDENTIFIER,
                end: '}',
                keywords: 'name count channels instance-data instance-state instance of',
                contains: [
                    // Instance overridden properties
                    {
                        className: 'keyword',
                        begin: '[a-zA-Z-_]+( |\t)*:'
                    },
                    hljs.HASH_COMMENT_MODE
                ]
            },

            // Component sections
            {
                className: 'component',
                begin: '^' + IDENTIFIER,
                end: '}',
                lexemes: '\\(?[a-zA-Z]+\\)?',
                keywords: 'installer exports children extends imports facets alias (optional)',
                contains: [
                    // Imported component variables
                    {
                        className: 'string',
                        begin: '\\.[a-zA-Z-_]+',
                        end: '\\s|,|;',
                        excludeEnd: true
                    },
                    hljs.HASH_COMMENT_MODE
                ]
            },

            // Comments
            hljs.HASH_COMMENT_MODE
        ]
    };
});
hljs.registerLanguage('rsl', function (hljs) {
    return {
        keywords: {
            keyword: 'float color point normal vector matrix while for if do return else break extern continue',
            built_in: 'abs acos ambient area asin atan atmosphere attribute calculatenormal ceil cellnoise ' +
            'clamp comp concat cos degrees depth Deriv diffuse distance Du Dv environment exp ' +
            'faceforward filterstep floor format fresnel incident length lightsource log match ' +
            'max min mod noise normalize ntransform opposite option phong pnoise pow printf ' +
            'ptlined radians random reflect refract renderinfo round setcomp setxcomp setycomp ' +
            'setzcomp shadow sign sin smoothstep specular specularbrdf spline sqrt step tan ' +
            'texture textureinfo trace transform vtransform xcomp ycomp zcomp'
        },
        illegal: '</',
        contains: [
            hljs.C_LINE_COMMENT_MODE,
            hljs.C_BLOCK_COMMENT_MODE,
            hljs.QUOTE_STRING_MODE,
            hljs.APOS_STRING_MODE,
            hljs.C_NUMBER_MODE, {
                className: 'preprocessor',
                begin: '#',
                end: '$'
            }, {
                className: 'shader',
                beginKeywords: 'surface displacement light volume imager',
                end: '\\('
            }, {
                className: 'shading',
                beginKeywords: 'illuminate illuminance gather',
                end: '\\('
            }
        ]
    };
});
hljs.registerLanguage('ruleslanguage', function (hljs) {
    return {
        keywords: {
            keyword: 'BILL_PERIOD BILL_START BILL_STOP RS_EFFECTIVE_START RS_EFFECTIVE_STOP RS_JURIS_CODE RS_OPCO_CODE ' +
            'INTDADDATTRIBUTE|5 INTDADDVMSG|5 INTDBLOCKOP|5 INTDBLOCKOPNA|5 INTDCLOSE|5 INTDCOUNT|5 ' +
            'INTDCOUNTSTATUSCODE|5 INTDCREATEMASK|5 INTDCREATEDAYMASK|5 INTDCREATEFACTORMASK|5 ' +
            'INTDCREATEHANDLE|5 INTDCREATEOVERRIDEDAYMASK|5 INTDCREATEOVERRIDEMASK|5 ' +
            'INTDCREATESTATUSCODEMASK|5 INTDCREATETOUPERIOD|5 INTDDELETE|5 INTDDIPTEST|5 INTDEXPORT|5 ' +
            'INTDGETERRORCODE|5 INTDGETERRORMESSAGE|5 INTDISEQUAL|5 INTDJOIN|5 INTDLOAD|5 INTDLOADACTUALCUT|5 ' +
            'INTDLOADDATES|5 INTDLOADHIST|5 INTDLOADLIST|5 INTDLOADLISTDATES|5 INTDLOADLISTENERGY|5 ' +
            'INTDLOADLISTHIST|5 INTDLOADRELATEDCHANNEL|5 INTDLOADSP|5 INTDLOADSTAGING|5 INTDLOADUOM|5 ' +
            'INTDLOADUOMDATES|5 INTDLOADUOMHIST|5 INTDLOADVERSION|5 INTDOPEN|5 INTDREADFIRST|5 INTDREADNEXT|5 ' +
            'INTDRECCOUNT|5 INTDRELEASE|5 INTDREPLACE|5 INTDROLLAVG|5 INTDROLLPEAK|5 INTDSCALAROP|5 INTDSCALE|5 ' +
            'INTDSETATTRIBUTE|5 INTDSETDSTPARTICIPANT|5 INTDSETSTRING|5 INTDSETVALUE|5 INTDSETVALUESTATUS|5 ' +
            'INTDSHIFTSTARTTIME|5 INTDSMOOTH|5 INTDSORT|5 INTDSPIKETEST|5 INTDSUBSET|5 INTDTOU|5 ' +
            'INTDTOURELEASE|5 INTDTOUVALUE|5 INTDUPDATESTATS|5 INTDVALUE|5 STDEV INTDDELETEEX|5 ' +
            'INTDLOADEXACTUAL|5 INTDLOADEXCUT|5 INTDLOADEXDATES|5 INTDLOADEX|5 INTDLOADEXRELATEDCHANNEL|5 ' +
            'INTDSAVEEX|5 MVLOAD|5 MVLOADACCT|5 MVLOADACCTDATES|5 MVLOADACCTHIST|5 MVLOADDATES|5 MVLOADHIST|5 ' +
            'MVLOADLIST|5 MVLOADLISTDATES|5 MVLOADLISTHIST|5 IF FOR NEXT DONE SELECT END CALL ABORT CLEAR CHANNEL FACTOR LIST NUMBER ' +
            'OVERRIDE SET WEEK DISTRIBUTIONNODE ELSE WHEN THEN OTHERWISE IENUM CSV INCLUDE LEAVE RIDER SAVE DELETE ' +
            'NOVALUE SECTION WARN SAVE_UPDATE DETERMINANT LABEL REPORT REVENUE EACH ' +
            'IN FROM TOTAL CHARGE BLOCK AND OR CSV_FILE RATE_CODE AUXILIARY_DEMAND ' +
            'UIDACCOUNT RS BILL_PERIOD_SELECT HOURS_PER_MONTH INTD_ERROR_STOP SEASON_SCHEDULE_NAME ' +
            'ACCOUNTFACTOR ARRAYUPPERBOUND CALLSTOREDPROC GETADOCONNECTION GETCONNECT GETDATASOURCE ' +
            'GETQUALIFIER GETUSERID HASVALUE LISTCOUNT LISTOP LISTUPDATE LISTVALUE PRORATEFACTOR RSPRORATE ' +
            'SETBINPATH SETDBMONITOR WQ_OPEN BILLINGHOURS DATE DATEFROMFLOAT DATETIMEFROMSTRING ' +
            'DATETIMETOSTRING DATETOFLOAT DAY DAYDIFF DAYNAME DBDATETIME HOUR MINUTE MONTH MONTHDIFF ' +
            'MONTHHOURS MONTHNAME ROUNDDATE SAMEWEEKDAYLASTYEAR SECOND WEEKDAY WEEKDIFF YEAR YEARDAY ' +
            'YEARSTR COMPSUM HISTCOUNT HISTMAX HISTMIN HISTMINNZ HISTVALUE MAXNRANGE MAXRANGE MINRANGE ' +
            'COMPIKVA COMPKVA COMPKVARFROMKQKW COMPLF IDATTR FLAG LF2KW LF2KWH MAXKW POWERFACTOR ' +
            'READING2USAGE AVGSEASON MAXSEASON MONTHLYMERGE SEASONVALUE SUMSEASON ACCTREADDATES ' +
            'ACCTTABLELOAD CONFIGADD CONFIGGET CREATEOBJECT CREATEREPORT EMAILCLIENT EXPBLKMDMUSAGE ' +
            'EXPMDMUSAGE EXPORT_USAGE FACTORINEFFECT GETUSERSPECIFIEDSTOP INEFFECT ISHOLIDAY RUNRATE ' +
            'SAVE_PROFILE SETREPORTTITLE USEREXIT WATFORRUNRATE TO TABLE ACOS ASIN ATAN ATAN2 BITAND CEIL ' +
            'COS COSECANT COSH COTANGENT DIVQUOT DIVREM EXP FABS FLOOR FMOD FREPM FREXPN LOG LOG10 MAX MAXN ' +
            'MIN MINNZ MODF POW ROUND ROUND2VALUE ROUNDINT SECANT SIN SINH SQROOT TAN TANH FLOAT2STRING ' +
            'FLOAT2STRINGNC INSTR LEFT LEN LTRIM MID RIGHT RTRIM STRING STRINGNC TOLOWER TOUPPER TRIM ' +
            'NUMDAYS READ_DATE STAGING',
            built_in: 'IDENTIFIER OPTIONS XML_ELEMENT XML_OP XML_ELEMENT_OF DOMDOCCREATE DOMDOCLOADFILE DOMDOCLOADXML ' +
            'DOMDOCSAVEFILE DOMDOCGETROOT DOMDOCADDPI DOMNODEGETNAME DOMNODEGETTYPE DOMNODEGETVALUE DOMNODEGETCHILDCT ' +
            'DOMNODEGETFIRSTCHILD DOMNODEGETSIBLING DOMNODECREATECHILDELEMENT DOMNODESETATTRIBUTE ' +
            'DOMNODEGETCHILDELEMENTCT DOMNODEGETFIRSTCHILDELEMENT DOMNODEGETSIBLINGELEMENT DOMNODEGETATTRIBUTECT ' +
            'DOMNODEGETATTRIBUTEI DOMNODEGETATTRIBUTEBYNAME DOMNODEGETBYNAME'
        },
        contains: [
            hljs.C_LINE_COMMENT_MODE,
            hljs.C_BLOCK_COMMENT_MODE,
            hljs.APOS_STRING_MODE,
            hljs.QUOTE_STRING_MODE,
            hljs.C_NUMBER_MODE, {
                className: 'array',
                begin: '\#[a-zA-Z\ \.]+'
            }
        ]
    };
});
hljs.registerLanguage('rust', function (hljs) {
    var BLOCK_COMMENT = hljs.inherit(hljs.C_BLOCK_COMMENT_MODE);
    BLOCK_COMMENT.contains.push('self');
    return {
        aliases: ['rs'],
        keywords: {
            keyword: 'alignof as be box break const continue crate do else enum extern ' +
            'false fn for if impl in let loop match mod mut offsetof once priv ' +
            'proc pub pure ref return self sizeof static struct super trait true ' +
            'type typeof unsafe unsized use virtual while yield ' +
            'int i8 i16 i32 i64 ' +
            'uint u8 u32 u64 ' +
            'float f32 f64 ' +
            'str char bool',
            built_in: 'assert! assert_eq! bitflags! bytes! cfg! col! concat! concat_idents! ' +
            'debug_assert! debug_assert_eq! env! panic! file! format! format_args! ' +
            'include_bin! include_str! line! local_data_key! module_path! ' +
            'option_env! print! println! select! stringify! try! unimplemented! ' +
            'unreachable! vec! write! writeln!'
        },
        lexemes: hljs.IDENT_RE + '!?',
        illegal: '</',
        contains: [
            hljs.C_LINE_COMMENT_MODE,
            BLOCK_COMMENT,
            hljs.inherit(hljs.QUOTE_STRING_MODE, {
                illegal: null
            }), {
                className: 'string',
                begin: /r(#*)".*?"\1(?!#)/
            }, {
                className: 'string',
                begin: /'\\?(x\w{2}|u\w{4}|U\w{8}|.)'/
            }, {
                begin: /'[a-zA-Z_][a-zA-Z0-9_]*/
            }, {
                className: 'number',
                begin: /\b(0[xb][A-Za-z0-9_]+|[0-9_]+(\.[0-9_]+)?([eE][+-]?[0-9_]+)?)([uif](8|16|32|64)?)?/,
                relevance: 0
            }, {
                className: 'function',
                beginKeywords: 'fn',
                end: '(\\(|<)',
                excludeEnd: true,
                contains: [hljs.UNDERSCORE_TITLE_MODE]
            }, {
                className: 'preprocessor',
                begin: '#\\!?\\[',
                end: '\\]'
            }, {
                beginKeywords: 'type',
                end: '(=|<)',
                contains: [hljs.UNDERSCORE_TITLE_MODE],
                illegal: '\\S'
            }, {
                beginKeywords: 'trait enum',
                end: '({|<)',
                contains: [hljs.UNDERSCORE_TITLE_MODE],
                illegal: '\\S'
            }, {
                begin: hljs.IDENT_RE + '::'
            }, {
                begin: '->'
            }
        ]
    };
});
hljs.registerLanguage('scala', function (hljs) {

    var ANNOTATION = {
        className: 'annotation',
        begin: '@[A-Za-z]+'
    };

    var STRING = {
        className: 'string',
        begin: 'u?r?"""',
        end: '"""',
        relevance: 10
    };

    var SYMBOL = {
        className: 'symbol',
        begin: '\'\\w[\\w\\d_]*(?!\')'
    };

    var TYPE = {
        className: 'type',
        begin: '\\b[A-Z][A-Za-z0-9_]*',
        relevance: 0
    };

    var NAME = {
        className: 'title',
        begin: /[^0-9\n\t "'(),.`{}\[\]:;][^\n\t "'(),.`{}\[\]:;]+|[^0-9\n\t "'(),.`{}\[\]:;=]/,
        relevance: 0
    };

    var CLASS = {
        className: 'class',
        beginKeywords: 'class object trait type',
        end: /[:={\[(\n;]/,
        contains: [{
            className: 'keyword',
            beginKeywords: 'extends with',
            relevance: 10
        }, NAME]
    };

    var METHOD = {
        className: 'function',
        beginKeywords: 'def val',
        end: /[:={\[(\n;]/,
        contains: [NAME]
    };

    var JAVADOC = {
        className: 'javadoc',
        begin: '/\\*\\*',
        end: '\\*/',
        contains: [{
            className: 'javadoctag',
            begin: '@[A-Za-z]+'
        }],
        relevance: 10
    };

    return {
        keywords: {
            literal: 'true false null',
            keyword: 'type yield lazy override def with val var sealed abstract private trait object if forSome for while throw finally protected extends import final return else break new catch super class case package default try this match continue throws implicit'
        },
        contains: [
            hljs.C_LINE_COMMENT_MODE,
            hljs.C_BLOCK_COMMENT_MODE,
            STRING,
            hljs.QUOTE_STRING_MODE,
            SYMBOL,
            TYPE,
            METHOD,
            CLASS,
            hljs.C_NUMBER_MODE,
            ANNOTATION
        ]
    };
});
hljs.registerLanguage('scheme', function (hljs) {
    var SCHEME_IDENT_RE = '[^\\(\\)\\[\\]\\{\\}",\'`;#|\\\\\\s]+';
    var SCHEME_SIMPLE_NUMBER_RE = '(\\-|\\+)?\\d+([./]\\d+)?';
    var SCHEME_COMPLEX_NUMBER_RE = SCHEME_SIMPLE_NUMBER_RE + '[+\\-]' + SCHEME_SIMPLE_NUMBER_RE + 'i';
    var BUILTINS = {
        built_in: 'case-lambda call/cc class define-class exit-handler field import ' +
        'inherit init-field interface let*-values let-values let/ec mixin ' +
        'opt-lambda override protect provide public rename require ' +
        'require-for-syntax syntax syntax-case syntax-error unit/sig unless ' +
        'when with-syntax and begin call-with-current-continuation ' +
        'call-with-input-file call-with-output-file case cond define ' +
        'define-syntax delay do dynamic-wind else for-each if lambda let let* ' +
        'let-syntax letrec letrec-syntax map or syntax-rules \' * + , ,@ - ... / ' +
        '; < <= = => > >= ` abs acos angle append apply asin assoc assq assv atan ' +
        'boolean? caar cadr call-with-input-file call-with-output-file ' +
        'call-with-values car cdddar cddddr cdr ceiling char->integer ' +
        'char-alphabetic? char-ci<=? char-ci<? char-ci=? char-ci>=? char-ci>? ' +
        'char-downcase char-lower-case? char-numeric? char-ready? char-upcase ' +
        'char-upper-case? char-whitespace? char<=? char<? char=? char>=? char>? ' +
        'char? close-input-port close-output-port complex? cons cos ' +
        'current-input-port current-output-port denominator display eof-object? ' +
        'eq? equal? eqv? eval even? exact->inexact exact? exp expt floor ' +
        'force gcd imag-part inexact->exact inexact? input-port? integer->char ' +
        'integer? interaction-environment lcm length list list->string ' +
        'list->vector list-ref list-tail list? load log magnitude make-polar ' +
        'make-rectangular make-string make-vector max member memq memv min ' +
        'modulo negative? newline not null-environment null? number->string ' +
        'number? numerator odd? open-input-file open-output-file output-port? ' +
        'pair? peek-char port? positive? procedure? quasiquote quote quotient ' +
        'rational? rationalize read read-char real-part real? remainder reverse ' +
        'round scheme-report-environment set! set-car! set-cdr! sin sqrt string ' +
        'string->list string->number string->symbol string-append string-ci<=? ' +
        'string-ci<? string-ci=? string-ci>=? string-ci>? string-copy ' +
        'string-fill! string-length string-ref string-set! string<=? string<? ' +
        'string=? string>=? string>? string? substring symbol->string symbol? ' +
        'tan transcript-off transcript-on truncate values vector ' +
        'vector->list vector-fill! vector-length vector-ref vector-set! ' +
        'with-input-from-file with-output-to-file write write-char zero?'
    };

    var SHEBANG = {
        className: 'shebang',
        begin: '^#!',
        end: '$'
    };

    var LITERAL = {
        className: 'literal',
        begin: '(#t|#f|#\\\\' + SCHEME_IDENT_RE + '|#\\\\.)'
    };

    var NUMBER = {
        className: 'number',
        variants: [{
            begin: SCHEME_SIMPLE_NUMBER_RE,
            relevance: 0
        }, {
            begin: SCHEME_COMPLEX_NUMBER_RE,
            relevance: 0
        }, {
            begin: '#b[0-1]+(/[0-1]+)?'
        }, {
            begin: '#o[0-7]+(/[0-7]+)?'
        }, {
            begin: '#x[0-9a-f]+(/[0-9a-f]+)?'
        }]
    };

    var STRING = hljs.QUOTE_STRING_MODE;

    var REGULAR_EXPRESSION = {
        className: 'regexp',
        begin: '#[pr]x"',
        end: '[^\\\\]"'
    };

    var COMMENT = {
        className: 'comment',
        variants: [{
            begin: ';',
            end: '$',
            relevance: 0
        }, {
            begin: '#\\|',
            end: '\\|#'
        }]
    };

    var IDENT = {
        begin: SCHEME_IDENT_RE,
        relevance: 0
    };

    var QUOTED_IDENT = {
        className: 'variable',
        begin: '\'' + SCHEME_IDENT_RE
    };

    var BODY = {
        endsWithParent: true,
        relevance: 0
    };

    var LIST = {
        className: 'list',
        variants: [{
            begin: '\\(',
            end: '\\)'
        }, {
            begin: '\\[',
            end: '\\]'
        }],
        contains: [{
            className: 'keyword',
            begin: SCHEME_IDENT_RE,
            lexemes: SCHEME_IDENT_RE,
            keywords: BUILTINS
        },
            BODY
        ]
    };

    BODY.contains = [LITERAL, NUMBER, STRING, COMMENT, IDENT, QUOTED_IDENT, LIST];

    return {
        illegal: /\S/,
        contains: [SHEBANG, NUMBER, STRING, COMMENT, QUOTED_IDENT, LIST]
    };
});
hljs.registerLanguage('scilab', function (hljs) {

    var COMMON_CONTAINS = [
        hljs.C_NUMBER_MODE, {
            className: 'string',
            begin: '\'|\"',
            end: '\'|\"',
            contains: [hljs.BACKSLASH_ESCAPE, {
                begin: '\'\''
            }]
        }
    ];

    return {
        aliases: ['sci'],
        keywords: {
            keyword: 'abort break case clear catch continue do elseif else endfunction end for function' +
            'global if pause return resume select try then while' +
            '%f %F %t %T %pi %eps %inf %nan %e %i %z %s',
            built_in: // Scilab has more than 2000 functions. Just list the most commons
            'abs and acos asin atan ceil cd chdir clearglobal cosh cos cumprod deff disp error' +
            'exec execstr exists exp eye gettext floor fprintf fread fsolve imag isdef isempty' +
            'isinfisnan isvector lasterror length load linspace list listfiles log10 log2 log' +
            'max min msprintf mclose mopen ones or pathconvert poly printf prod pwd rand real' +
            'round sinh sin size gsort sprintf sqrt strcat strcmps tring sum system tanh tan' +
            'type typename warning zeros matrix'
        },
        illegal: '("|#|/\\*|\\s+/\\w+)',
        contains: [{
            className: 'function',
            beginKeywords: 'function endfunction',
            end: '$',
            keywords: 'function endfunction|10',
            contains: [
                hljs.UNDERSCORE_TITLE_MODE, {
                    className: 'params',
                    begin: '\\(',
                    end: '\\)'
                }
            ]
        }, {
            className: 'transposed_variable',
            begin: '[a-zA-Z_][a-zA-Z_0-9]*(\'+[\\.\']*|[\\.\']+)',
            end: '',
            relevance: 0
        }, {
            className: 'matrix',
            begin: '\\[',
            end: '\\]\'*[\\.\']*',
            relevance: 0,
            contains: COMMON_CONTAINS
        }, {
            className: 'comment',
            begin: '//',
            end: '$'
        }].concat(COMMON_CONTAINS)
    };
});
hljs.registerLanguage('scss', function (hljs) {
    var IDENT_RE = '[a-zA-Z-][a-zA-Z0-9_-]*';
    var VARIABLE = {
        className: 'variable',
        begin: '(\\$' + IDENT_RE + ')\\b'
    };
    var FUNCTION = {
        className: 'function',
        begin: IDENT_RE + '\\(',
        returnBegin: true,
        excludeEnd: true,
        end: '\\('
    };
    var HEXCOLOR = {
        className: 'hexcolor',
        begin: '#[0-9A-Fa-f]+'
    };
    var DEF_INTERNALS = {
        className: 'attribute',
        begin: '[A-Z\\_\\.\\-]+',
        end: ':',
        excludeEnd: true,
        illegal: '[^\\s]',
        starts: {
            className: 'value',
            endsWithParent: true,
            excludeEnd: true,
            contains: [
                FUNCTION,
                HEXCOLOR,
                hljs.CSS_NUMBER_MODE,
                hljs.QUOTE_STRING_MODE,
                hljs.APOS_STRING_MODE,
                hljs.C_BLOCK_COMMENT_MODE, {
                    className: 'important',
                    begin: '!important'
                }
            ]
        }
    };
    return {
        case_insensitive: true,
        illegal: '[=/|\']',
        contains: [
            hljs.C_LINE_COMMENT_MODE,
            hljs.C_BLOCK_COMMENT_MODE,
            FUNCTION, {
                className: 'id',
                begin: '\\#[A-Za-z0-9_-]+',
                relevance: 0
            }, {
                className: 'class',
                begin: '\\.[A-Za-z0-9_-]+',
                relevance: 0
            }, {
                className: 'attr_selector',
                begin: '\\[',
                end: '\\]',
                illegal: '$'
            }, {
                className: 'tag', // begin: IDENT_RE, end: '[,|\\s]'
                begin: '\\b(a|abbr|acronym|address|area|article|aside|audio|b|base|big|blockquote|body|br|button|canvas|caption|cite|code|col|colgroup|command|datalist|dd|del|details|dfn|div|dl|dt|em|embed|fieldset|figcaption|figure|footer|form|frame|frameset|(h[1-6])|head|header|hgroup|hr|html|i|iframe|img|input|ins|kbd|keygen|label|legend|li|link|map|mark|meta|meter|nav|noframes|noscript|object|ol|optgroup|option|output|p|param|pre|progress|q|rp|rt|ruby|samp|script|section|select|small|span|strike|strong|style|sub|sup|table|tbody|td|textarea|tfoot|th|thead|time|title|tr|tt|ul|var|video)\\b',
                relevance: 0
            }, {
                className: 'pseudo',
                begin: ':(visited|valid|root|right|required|read-write|read-only|out-range|optional|only-of-type|only-child|nth-of-type|nth-last-of-type|nth-last-child|nth-child|not|link|left|last-of-type|last-child|lang|invalid|indeterminate|in-range|hover|focus|first-of-type|first-line|first-letter|first-child|first|enabled|empty|disabled|default|checked|before|after|active)'
            }, {
                className: 'pseudo',
                begin: '::(after|before|choices|first-letter|first-line|repeat-index|repeat-item|selection|value)'
            },
            VARIABLE, {
                className: 'attribute',
                begin: '\\b(z-index|word-wrap|word-spacing|word-break|width|widows|white-space|visibility|vertical-align|unicode-bidi|transition-timing-function|transition-property|transition-duration|transition-delay|transition|transform-style|transform-origin|transform|top|text-underline-position|text-transform|text-shadow|text-rendering|text-overflow|text-indent|text-decoration-style|text-decoration-line|text-decoration-color|text-decoration|text-align-last|text-align|tab-size|table-layout|right|resize|quotes|position|pointer-events|perspective-origin|perspective|page-break-inside|page-break-before|page-break-after|padding-top|padding-right|padding-left|padding-bottom|padding|overflow-y|overflow-x|overflow-wrap|overflow|outline-width|outline-style|outline-offset|outline-color|outline|orphans|order|opacity|object-position|object-fit|normal|none|nav-up|nav-right|nav-left|nav-index|nav-down|min-width|min-height|max-width|max-height|mask|marks|margin-top|margin-right|margin-left|margin-bottom|margin|list-style-type|list-style-position|list-style-image|list-style|line-height|letter-spacing|left|justify-content|initial|inherit|ime-mode|image-orientation|image-resolution|image-rendering|icon|hyphens|height|font-weight|font-variant-ligatures|font-variant|font-style|font-stretch|font-size-adjust|font-size|font-language-override|font-kerning|font-feature-settings|font-family|font|float|flex-wrap|flex-shrink|flex-grow|flex-flow|flex-direction|flex-basis|flex|filter|empty-cells|display|direction|cursor|counter-reset|counter-increment|content|column-width|column-span|column-rule-width|column-rule-style|column-rule-color|column-rule|column-gap|column-fill|column-count|columns|color|clip-path|clip|clear|caption-side|break-inside|break-before|break-after|box-sizing|box-shadow|box-decoration-break|bottom|border-width|border-top-width|border-top-style|border-top-right-radius|border-top-left-radius|border-top-color|border-top|border-style|border-spacing|border-right-width|border-right-style|border-right-color|border-right|border-radius|border-left-width|border-left-style|border-left-color|border-left|border-image-width|border-image-source|border-image-slice|border-image-repeat|border-image-outset|border-image|border-color|border-collapse|border-bottom-width|border-bottom-style|border-bottom-right-radius|border-bottom-left-radius|border-bottom-color|border-bottom|border|background-size|background-repeat|background-position|background-origin|background-image|background-color|background-clip|background-attachment|background|backface-visibility|auto|animation-timing-function|animation-play-state|animation-name|animation-iteration-count|animation-fill-mode|animation-duration|animation-direction|animation-delay|animation|align-self|align-items|align-content)\\b',
                illegal: '[^\\s]'
            }, {
                className: 'value',
                begin: '\\b(whitespace|wait|w-resize|visible|vertical-text|vertical-ideographic|uppercase|upper-roman|upper-alpha|underline|transparent|top|thin|thick|text|text-top|text-bottom|tb-rl|table-header-group|table-footer-group|sw-resize|super|strict|static|square|solid|small-caps|separate|se-resize|scroll|s-resize|rtl|row-resize|ridge|right|repeat|repeat-y|repeat-x|relative|progress|pointer|overline|outside|outset|oblique|nowrap|not-allowed|normal|none|nw-resize|no-repeat|no-drop|newspaper|ne-resize|n-resize|move|middle|medium|ltr|lr-tb|lowercase|lower-roman|lower-alpha|loose|list-item|line|line-through|line-edge|lighter|left|keep-all|justify|italic|inter-word|inter-ideograph|inside|inset|inline|inline-block|inherit|inactive|ideograph-space|ideograph-parenthesis|ideograph-numeric|ideograph-alpha|horizontal|hidden|help|hand|groove|fixed|ellipsis|e-resize|double|dotted|distribute|distribute-space|distribute-letter|distribute-all-lines|disc|disabled|default|decimal|dashed|crosshair|collapse|col-resize|circle|char|center|capitalize|break-word|break-all|bottom|both|bolder|bold|block|bidi-override|below|baseline|auto|always|all-scroll|absolute|table|table-cell)\\b'
            }, {
                className: 'value',
                begin: ':',
                end: ';',
                contains: [
                    FUNCTION,
                    VARIABLE,
                    HEXCOLOR,
                    hljs.CSS_NUMBER_MODE,
                    hljs.QUOTE_STRING_MODE,
                    hljs.APOS_STRING_MODE, {
                        className: 'important',
                        begin: '!important'
                    }
                ]
            }, {
                className: 'at_rule',
                begin: '@',
                end: '[{;]',
                keywords: 'mixin include extend for if else each while charset import debug media page content font-face namespace warn',
                contains: [
                    FUNCTION,
                    VARIABLE,
                    hljs.QUOTE_STRING_MODE,
                    hljs.APOS_STRING_MODE,
                    HEXCOLOR,
                    hljs.CSS_NUMBER_MODE, {
                        className: 'preprocessor',
                        begin: '\\s[A-Za-z0-9_.-]+',
                        relevance: 0
                    }
                ]
            }
        ]
    };
});
hljs.registerLanguage('smali', function (hljs) {
    var smali_instr_low_prio = ['add', 'and', 'cmp', 'cmpg', 'cmpl', 'const', 'div', 'double', 'float', 'goto', 'if', 'int', 'long', 'move', 'mul', 'neg', 'new', 'nop', 'not', 'or', 'rem', 'return', 'shl', 'shr', 'sput', 'sub', 'throw', 'ushr', 'xor'];
    var smali_instr_high_prio = ['aget', 'aput', 'array', 'check', 'execute', 'fill', 'filled', 'goto/16', 'goto/32', 'iget', 'instance', 'invoke', 'iput', 'monitor', 'packed', 'sget', 'sparse'];
    var smali_keywords = ['transient', 'constructor', 'abstract', 'final', 'synthetic', 'public', 'private', 'protected', 'static', 'bridge', 'system'];
    return {
        aliases: ['smali'],
        contains: [{
            className: 'string',
            begin: '"',
            end: '"',
            relevance: 0
        }, {
            className: 'comment',
            begin: '#',
            end: '$',
            relevance: 0
        }, {
            className: 'keyword',
            begin: '\\s*\\.end\\s[a-zA-Z0-9]*',
            relevance: 1
        }, {
            className: 'keyword',
            begin: '^[ ]*\\.[a-zA-Z]*',
            relevance: 0
        }, {
            className: 'keyword',
            begin: '\\s:[a-zA-Z_0-9]*',
            relevance: 0
        }, {
            className: 'keyword',
            begin: '\\s(' + smali_keywords.join('|') + ')',
            relevance: 1
        }, {
            className: 'keyword',
            begin: '\\[',
            relevance: 0
        }, {
            className: 'instruction',
            begin: '\\s(' + smali_instr_low_prio.join('|') + ')\\s',
            relevance: 1
        }, {
            className: 'instruction',
            begin: '\\s(' + smali_instr_low_prio.join('|') + ')((\\-|/)[a-zA-Z0-9]+)+\\s',
            relevance: 10
        }, {
            className: 'instruction',
            begin: '\\s(' + smali_instr_high_prio.join('|') + ')((\\-|/)[a-zA-Z0-9]+)*\\s',
            relevance: 10
        }, {
            className: 'class',
            begin: 'L[^\(;:\n]*;',
            relevance: 0
        }, {
            className: 'function',
            begin: '( |->)[^(\n ;"]*\\(',
            relevance: 0
        }, {
            className: 'function',
            begin: '\\)',
            relevance: 0
        }, {
            className: 'variable',
            begin: '[vp][0-9]+',
            relevance: 0
        }]
    };
});
hljs.registerLanguage('smalltalk', function (hljs) {
    var VAR_IDENT_RE = '[a-z][a-zA-Z0-9_]*';
    var CHAR = {
        className: 'char',
        begin: '\\$.{1}'
    };
    var SYMBOL = {
        className: 'symbol',
        begin: '#' + hljs.UNDERSCORE_IDENT_RE
    };
    return {
        aliases: ['st'],
        keywords: 'self super nil true false thisContext', // only 6
        contains: [{
            className: 'comment',
            begin: '"',
            end: '"'
        },
            hljs.APOS_STRING_MODE, {
                className: 'class',
                begin: '\\b[A-Z][A-Za-z0-9_]*',
                relevance: 0
            }, {
                className: 'method',
                begin: VAR_IDENT_RE + ':',
                relevance: 0
            },
            hljs.C_NUMBER_MODE,
            SYMBOL,
            CHAR, {
                className: 'localvars',
                // This looks more complicated than needed to avoid combinatorial
                // explosion under V8. It effectively means `| var1 var2 ... |` with
                // whitespace adjacent to `|` being optional.
                begin: '\\|[ ]*' + VAR_IDENT_RE + '([ ]+' + VAR_IDENT_RE + ')*[ ]*\\|',
                returnBegin: true,
                end: /\|/,
                illegal: /\S/,
                contains: [{
                    begin: '(\\|[ ]*)?' + VAR_IDENT_RE
                }]
            }, {
                className: 'array',
                begin: '\\#\\(',
                end: '\\)',
                contains: [
                    hljs.APOS_STRING_MODE,
                    CHAR,
                    hljs.C_NUMBER_MODE,
                    SYMBOL
                ]
            }
        ]
    };
});
hljs.registerLanguage('sml', function (hljs) {
    return {
        aliases: ['ml'],
        keywords: {
            keyword: /* according to Definition of Standard ML 97  */
            'abstype and andalso as case datatype do else end eqtype ' +
            'exception fn fun functor handle if in include infix infixr ' +
            'let local nonfix of op open orelse raise rec sharing sig ' +
            'signature struct structure then type val with withtype where while',
            built_in: /* built-in types according to basis library */
                'array bool char exn int list option order real ref string substring vector unit word',
            literal: 'true false NONE SOME LESS EQUAL GREATER nil'
        },
        illegal: /\/\/|>>/,
        lexemes: '[a-z_]\\w*!?',
        contains: [{
            className: 'literal',
            begin: '\\[(\\|\\|)?\\]|\\(\\)'
        }, {
            className: 'comment',
            begin: '\\(\\*',
            end: '\\*\\)',
            contains: ['self', hljs.PHRASAL_WORDS_MODE]
        }, {
            /* type variable */
            className: 'symbol',
            begin: '\'[A-Za-z_](?!\')[\\w\']*'
            /* the grammar is ambiguous on how 'a'b should be interpreted but not the compiler */
        }, {
            /* polymorphic variant */
            className: 'tag',
            begin: '`[A-Z][\\w\']*'
        }, {
            /* module or constructor */
            className: 'type',
            begin: '\\b[A-Z][\\w\']*',
            relevance: 0
        }, {
            /* don't color identifiers, but safely catch all identifiers with '*/
            begin: '[a-z_]\\w*\'[\\w\']*'
        },
            hljs.inherit(hljs.APOS_STRING_MODE, {
                className: 'char',
                relevance: 0
            }),
            hljs.inherit(hljs.QUOTE_STRING_MODE, {
                illegal: null
            }), {
                className: 'number',
                begin: '\\b(0[xX][a-fA-F0-9_]+[Lln]?|' +
                '0[oO][0-7_]+[Lln]?|' +
                '0[bB][01_]+[Lln]?|' +
                '[0-9][0-9_]*([Lln]|(\\.[0-9_]*)?([eE][-+]?[0-9_]+)?)?)',
                relevance: 0
            }, {
                begin: /[-=]>/ // relevance booster
            }
        ]
    };
});
hljs.registerLanguage('sql', function (hljs) {
    var COMMENT_MODE = {
        className: 'comment',
        begin: '--',
        end: '$'
    };
    return {
        case_insensitive: true,
        illegal: /[<>]/,
        contains: [{
            className: 'operator',
            beginKeywords: 'begin end start commit rollback savepoint lock alter create drop rename call ' +
            'delete do handler insert load replace select truncate update set show pragma grant ' +
            'merge describe use explain help declare prepare execute deallocate savepoint release ' +
            'unlock purge reset change stop analyze cache flush optimize repair kill ' +
            'install uninstall checksum restore check backup revoke',
            end: /;/,
            endsWithParent: true,
            keywords: {
                keyword: 'abs absolute acos action add adddate addtime aes_decrypt aes_encrypt after aggregate all allocate alter ' +
                'analyze and any are as asc ascii asin assertion at atan atan2 atn2 authorization authors avg backup ' +
                'before begin benchmark between bin binlog bit_and bit_count bit_length bit_or bit_xor both by ' +
                'cache call cascade cascaded case cast catalog ceil ceiling chain change changed char_length ' +
                'character_length charindex charset check checksum checksum_agg choose close coalesce ' +
                'coercibility collate collation collationproperty column columns columns_updated commit compress concat ' +
                'concat_ws concurrent connect connection connection_id consistent constraint constraints continue ' +
                'contributors conv convert convert_tz corresponding cos cot count count_big crc32 create cross cume_dist ' +
                'curdate current current_date current_time current_timestamp current_user cursor curtime data database ' +
                'databases datalength date_add date_format date_sub dateadd datediff datefromparts datename ' +
                'datepart datetime2fromparts datetimeoffsetfromparts day dayname dayofmonth dayofweek dayofyear ' +
                'deallocate declare decode default deferrable deferred degrees delayed delete des_decrypt ' +
                'des_encrypt des_key_file desc describe descriptor diagnostics difference disconnect distinct ' +
                'distinctrow div do domain double drop dumpfile each else elt enclosed encode encrypt end end-exec ' +
                'engine engines eomonth errors escape escaped event eventdata events except exception exec execute ' +
                'exists exp explain export_set extended external extract fast fetch field fields find_in_set ' +
                'first first_value floor flush for force foreign format found found_rows from from_base64 ' +
                'from_days from_unixtime full function get get_format get_lock getdate getutcdate global go goto grant ' +
                'grants greatest group group_concat grouping grouping_id gtid_subset gtid_subtract handler having help ' +
                'hex high_priority hosts hour ident_current ident_incr ident_seed identified identity if ifnull ignore ' +
                'iif ilike immediate in index indicator inet6_aton inet6_ntoa inet_aton inet_ntoa infile initially inner ' +
                'innodb input insert install instr intersect into is is_free_lock is_ipv4 ' +
                'is_ipv4_compat is_ipv4_mapped is_not is_not_null is_used_lock isdate isnull isolation join key kill ' +
                'language last last_day last_insert_id last_value lcase lead leading least leaves left len lenght level ' +
                'like limit lines ln load load_file local localtime localtimestamp locate lock log log10 log2 logfile ' +
                'logs low_priority lower lpad ltrim make_set makedate maketime master master_pos_wait match matched max ' +
                'md5 medium merge microsecond mid min minute mod mode module month monthname mutex name_const names ' +
                'national natural nchar next no no_write_to_binlog not now nullif nvarchar oct ' +
                'octet_length of old_password on only open optimize option optionally or ord order outer outfile output ' +
                'pad parse partial partition password patindex percent_rank percentile_cont percentile_disc period_add ' +
                'period_diff pi plugin position pow power pragma precision prepare preserve primary prior privileges ' +
                'procedure procedure_analyze processlist profile profiles public publishingservername purge quarter ' +
                'query quick quote quotename radians rand read references regexp relative relaylog release ' +
                'release_lock rename repair repeat replace replicate reset restore restrict return returns reverse ' +
                'revoke right rlike rollback rollup round row row_count rows rpad rtrim savepoint schema scroll ' +
                'sec_to_time second section select serializable server session session_user set sha sha1 sha2 share ' +
                'show sign sin size slave sleep smalldatetimefromparts snapshot some soname soundex ' +
                'sounds_like space sql sql_big_result sql_buffer_result sql_cache sql_calc_found_rows sql_no_cache ' +
                'sql_small_result sql_variant_property sqlstate sqrt square start starting status std ' +
                'stddev stddev_pop stddev_samp stdev stdevp stop str str_to_date straight_join strcmp string stuff ' +
                'subdate substr substring subtime subtring_index sum switchoffset sysdate sysdatetime sysdatetimeoffset ' +
                'system_user sysutcdatetime table tables tablespace tan temporary terminated tertiary_weights then time ' +
                'time_format time_to_sec timediff timefromparts timestamp timestampadd timestampdiff timezone_hour ' +
                'timezone_minute to to_base64 to_days to_seconds todatetimeoffset trailing transaction translation ' +
                'trigger trigger_nestlevel triggers trim truncate try_cast try_convert try_parse ucase uncompress ' +
                'uncompressed_length unhex unicode uninstall union unique unix_timestamp unknown unlock update upgrade ' +
                'upped upper usage use user user_resources using utc_date utc_time utc_timestamp uuid uuid_short ' +
                'validate_password_strength value values var var_pop var_samp variables variance varp ' +
                'version view warnings week weekday weekofyear weight_string when whenever where with work write xml ' +
                'xor year yearweek zon',
                literal: 'true false null',
                built_in: 'array bigint binary bit blob boolean char character date dec decimal float int integer interval number ' +
                'numeric real serial smallint varchar varying int8 serial8 text'
            },
            contains: [{
                className: 'string',
                begin: '\'',
                end: '\'',
                contains: [hljs.BACKSLASH_ESCAPE, {
                    begin: '\'\''
                }]
            }, {
                className: 'string',
                begin: '"',
                end: '"',
                contains: [hljs.BACKSLASH_ESCAPE, {
                    begin: '""'
                }]
            }, {
                className: 'string',
                begin: '`',
                end: '`',
                contains: [hljs.BACKSLASH_ESCAPE]
            },
                hljs.C_NUMBER_MODE,
                hljs.C_BLOCK_COMMENT_MODE,
                COMMENT_MODE
            ]
        },
            hljs.C_BLOCK_COMMENT_MODE,
            COMMENT_MODE
        ]
    };
});
hljs.registerLanguage('stata', function (hljs) {
    return {
        aliases: ['do', 'ado'],
        case_insensitive: true,
        keywords: 'if else in foreach for forv forva forval forvalu forvalue forvalues by bys bysort xi quietly qui capture about ac ac_7 acprplot acprplot_7 adjust ado adopath adoupdate alpha ameans an ano anov anova anova_estat anova_terms anovadef aorder ap app appe appen append arch arch_dr arch_estat arch_p archlm areg areg_p args arima arima_dr arima_estat arima_p as asmprobit asmprobit_estat asmprobit_lf asmprobit_mfx__dlg asmprobit_p ass asse asser assert avplot avplot_7 avplots avplots_7 bcskew0 bgodfrey binreg bip0_lf biplot bipp_lf bipr_lf bipr_p biprobit bitest bitesti bitowt blogit bmemsize boot bootsamp bootstrap bootstrap_8 boxco_l boxco_p boxcox boxcox_6 boxcox_p bprobit br break brier bro brow brows browse brr brrstat bs bs_7 bsampl_w bsample bsample_7 bsqreg bstat bstat_7 bstat_8 bstrap bstrap_7 ca ca_estat ca_p cabiplot camat canon canon_8 canon_8_p canon_estat canon_p cap caprojection capt captu captur capture cat cc cchart cchart_7 cci cd censobs_table centile cf char chdir checkdlgfiles checkestimationsample checkhlpfiles checksum chelp ci cii cl class classutil clear cli clis clist clo clog clog_lf clog_p clogi clogi_sw clogit clogit_lf clogit_p clogitp clogl_sw cloglog clonevar clslistarray cluster cluster_measures cluster_stop cluster_tree cluster_tree_8 clustermat cmdlog cnr cnre cnreg cnreg_p cnreg_sw cnsreg codebook collaps4 collapse colormult_nb colormult_nw compare compress conf confi confir confirm conren cons const constr constra constrai constrain constraint continue contract copy copyright copysource cor corc corr corr2data corr_anti corr_kmo corr_smc corre correl correla correlat correlate corrgram cou coun count cox cox_p cox_sw coxbase coxhaz coxvar cprplot cprplot_7 crc cret cretu cretur creturn cross cs cscript cscript_log csi ct ct_is ctset ctst_5 ctst_st cttost cumsp cumsp_7 cumul cusum cusum_7 cutil d datasig datasign datasigna datasignat datasignatu datasignatur datasignature datetof db dbeta de dec deco decod decode deff des desc descr descri describ describe destring dfbeta dfgls dfuller di di_g dir dirstats dis discard disp disp_res disp_s displ displa display distinct do doe doed doedi doedit dotplot dotplot_7 dprobit drawnorm drop ds ds_util dstdize duplicates durbina dwstat dydx e ed edi edit egen eivreg emdef en enc enco encod encode eq erase ereg ereg_lf ereg_p ereg_sw ereghet ereghet_glf ereghet_glf_sh ereghet_gp ereghet_ilf ereghet_ilf_sh ereghet_ip eret eretu eretur ereturn err erro error est est_cfexist est_cfname est_clickable est_expand est_hold est_table est_unhold est_unholdok estat estat_default estat_summ estat_vce_only esti estimates etodow etof etomdy ex exi exit expand expandcl fac fact facto factor factor_estat factor_p factor_pca_rotated factor_rotate factormat fcast fcast_compute fcast_graph fdades fdadesc fdadescr fdadescri fdadescrib fdadescribe fdasav fdasave fdause fh_st file open file read file close file filefilter fillin find_hlp_file findfile findit findit_7 fit fl fli flis flist for5_0 form forma format fpredict frac_154 frac_adj frac_chk frac_cox frac_ddp frac_dis frac_dv frac_in frac_mun frac_pp frac_pq frac_pv frac_wgt frac_xo fracgen fracplot fracplot_7 fracpoly fracpred fron_ex fron_hn fron_p fron_tn fron_tn2 frontier ftodate ftoe ftomdy ftowdate g gamhet_glf gamhet_gp gamhet_ilf gamhet_ip gamma gamma_d2 gamma_p gamma_sw gammahet gdi_hexagon gdi_spokes ge gen gene gener genera generat generate genrank genstd genvmean gettoken gl gladder gladder_7 glim_l01 glim_l02 glim_l03 glim_l04 glim_l05 glim_l06 glim_l07 glim_l08 glim_l09 glim_l10 glim_l11 glim_l12 glim_lf glim_mu glim_nw1 glim_nw2 glim_nw3 glim_p glim_v1 glim_v2 glim_v3 glim_v4 glim_v5 glim_v6 glim_v7 glm glm_6 glm_p glm_sw glmpred glo glob globa global glogit glogit_8 glogit_p gmeans gnbre_lf gnbreg gnbreg_5 gnbreg_p gomp_lf gompe_sw gomper_p gompertz gompertzhet gomphet_glf gomphet_glf_sh gomphet_gp gomphet_ilf gomphet_ilf_sh gomphet_ip gphdot gphpen gphprint gprefs gprobi_p gprobit gprobit_8 gr gr7 gr_copy gr_current gr_db gr_describe gr_dir gr_draw gr_draw_replay gr_drop gr_edit gr_editviewopts gr_example gr_example2 gr_export gr_print gr_qscheme gr_query gr_read gr_rename gr_replay gr_save gr_set gr_setscheme gr_table gr_undo gr_use graph graph7 grebar greigen greigen_7 greigen_8 grmeanby grmeanby_7 gs_fileinfo gs_filetype gs_graphinfo gs_stat gsort gwood h hadimvo hareg hausman haver he heck_d2 heckma_p heckman heckp_lf heckpr_p heckprob hel help hereg hetpr_lf hetpr_p hetprob hettest hexdump hilite hist hist_7 histogram hlogit hlu hmeans hotel hotelling hprobit hreg hsearch icd9 icd9_ff icd9p iis impute imtest inbase include inf infi infil infile infix inp inpu input ins insheet insp inspe inspec inspect integ inten intreg intreg_7 intreg_p intrg2_ll intrg_ll intrg_ll2 ipolate iqreg ir irf irf_create irfm iri is_svy is_svysum isid istdize ivprob_1_lf ivprob_lf ivprobit ivprobit_p ivreg ivreg_footnote ivtob_1_lf ivtob_lf ivtobit ivtobit_p jackknife jacknife jknife jknife_6 jknife_8 jkstat joinby kalarma1 kap kap_3 kapmeier kappa kapwgt kdensity kdensity_7 keep ksm ksmirnov ktau kwallis l la lab labe label labelbook ladder levels levelsof leverage lfit lfit_p li lincom line linktest lis list lloghet_glf lloghet_glf_sh lloghet_gp lloghet_ilf lloghet_ilf_sh lloghet_ip llogi_sw llogis_p llogist llogistic llogistichet lnorm_lf lnorm_sw lnorma_p lnormal lnormalhet lnormhet_glf lnormhet_glf_sh lnormhet_gp lnormhet_ilf lnormhet_ilf_sh lnormhet_ip lnskew0 loadingplot loc loca local log logi logis_lf logistic logistic_p logit logit_estat logit_p loglogs logrank loneway lookfor lookup lowess lowess_7 lpredict lrecomp lroc lroc_7 lrtest ls lsens lsens_7 lsens_x lstat ltable ltable_7 ltriang lv lvr2plot lvr2plot_7 m ma mac macr macro makecns man manova manova_estat manova_p manovatest mantel mark markin markout marksample mat mat_capp mat_order mat_put_rr mat_rapp mata mata_clear mata_describe mata_drop mata_matdescribe mata_matsave mata_matuse mata_memory mata_mlib mata_mosave mata_rename mata_which matalabel matcproc matlist matname matr matri matrix matrix_input__dlg matstrik mcc mcci md0_ md1_ md1debug_ md2_ md2debug_ mds mds_estat mds_p mdsconfig mdslong mdsmat mdsshepard mdytoe mdytof me_derd mean means median memory memsize meqparse mer merg merge mfp mfx mhelp mhodds minbound mixed_ll mixed_ll_reparm mkassert mkdir mkmat mkspline ml ml_5 ml_adjs ml_bhhhs ml_c_d ml_check ml_clear ml_cnt ml_debug ml_defd ml_e0 ml_e0_bfgs ml_e0_cycle ml_e0_dfp ml_e0i ml_e1 ml_e1_bfgs ml_e1_bhhh ml_e1_cycle ml_e1_dfp ml_e2 ml_e2_cycle ml_ebfg0 ml_ebfr0 ml_ebfr1 ml_ebh0q ml_ebhh0 ml_ebhr0 ml_ebr0i ml_ecr0i ml_edfp0 ml_edfr0 ml_edfr1 ml_edr0i ml_eds ml_eer0i ml_egr0i ml_elf ml_elf_bfgs ml_elf_bhhh ml_elf_cycle ml_elf_dfp ml_elfi ml_elfs ml_enr0i ml_enrr0 ml_erdu0 ml_erdu0_bfgs ml_erdu0_bhhh ml_erdu0_bhhhq ml_erdu0_cycle ml_erdu0_dfp ml_erdu0_nrbfgs ml_exde ml_footnote ml_geqnr ml_grad0 ml_graph ml_hbhhh ml_hd0 ml_hold ml_init ml_inv ml_log ml_max ml_mlout ml_mlout_8 ml_model ml_nb0 ml_opt ml_p ml_plot ml_query ml_rdgrd ml_repor ml_s_e ml_score ml_searc ml_technique ml_unhold mleval mlf_ mlmatbysum mlmatsum mlog mlogi mlogit mlogit_footnote mlogit_p mlopts mlsum mlvecsum mnl0_ mor more mov move mprobit mprobit_lf mprobit_p mrdu0_ mrdu1_ mvdecode mvencode mvreg mvreg_estat n nbreg nbreg_al nbreg_lf nbreg_p nbreg_sw nestreg net newey newey_7 newey_p news nl nl_7 nl_9 nl_9_p nl_p nl_p_7 nlcom nlcom_p nlexp2 nlexp2_7 nlexp2a nlexp2a_7 nlexp3 nlexp3_7 nlgom3 nlgom3_7 nlgom4 nlgom4_7 nlinit nllog3 nllog3_7 nllog4 nllog4_7 nlog_rd nlogit nlogit_p nlogitgen nlogittree nlpred no nobreak noi nois noisi noisil noisily note notes notes_dlg nptrend numlabel numlist odbc old_ver olo olog ologi ologi_sw ologit ologit_p ologitp on one onew onewa oneway op_colnm op_comp op_diff op_inv op_str opr opro oprob oprob_sw oprobi oprobi_p oprobit oprobitp opts_exclusive order orthog orthpoly ou out outf outfi outfil outfile outs outsh outshe outshee outsheet ovtest pac pac_7 palette parse parse_dissim pause pca pca_8 pca_display pca_estat pca_p pca_rotate pcamat pchart pchart_7 pchi pchi_7 pcorr pctile pentium pergram pergram_7 permute permute_8 personal peto_st pkcollapse pkcross pkequiv pkexamine pkexamine_7 pkshape pksumm pksumm_7 pl plo plot plugin pnorm pnorm_7 poisgof poiss_lf poiss_sw poisso_p poisson poisson_estat post postclose postfile postutil pperron pr prais prais_e prais_e2 prais_p predict predictnl preserve print pro prob probi probit probit_estat probit_p proc_time procoverlay procrustes procrustes_estat procrustes_p profiler prog progr progra program prop proportion prtest prtesti pwcorr pwd q\\s qby qbys qchi qchi_7 qladder qladder_7 qnorm qnorm_7 qqplot qqplot_7 qreg qreg_c qreg_p qreg_sw qu quadchk quantile quantile_7 que quer query range ranksum ratio rchart rchart_7 rcof recast reclink recode reg reg3 reg3_p regdw regr regre regre_p2 regres regres_p regress regress_estat regriv_p remap ren rena renam rename renpfix repeat replace report reshape restore ret retu retur return rm rmdir robvar roccomp roccomp_7 roccomp_8 rocf_lf rocfit rocfit_8 rocgold rocplot rocplot_7 roctab roctab_7 rolling rologit rologit_p rot rota rotat rotate rotatemat rreg rreg_p ru run runtest rvfplot rvfplot_7 rvpplot rvpplot_7 sa safesum sample sampsi sav save savedresults saveold sc sca scal scala scalar scatter scm_mine sco scob_lf scob_p scobi_sw scobit scor score scoreplot scoreplot_help scree screeplot screeplot_help sdtest sdtesti se search separate seperate serrbar serrbar_7 serset set set_defaults sfrancia sh she shel shell shewhart shewhart_7 signestimationsample signrank signtest simul simul_7 simulate simulate_8 sktest sleep slogit slogit_d2 slogit_p smooth snapspan so sor sort spearman spikeplot spikeplot_7 spikeplt spline_x split sqreg sqreg_p sret sretu sretur sreturn ssc st st_ct st_hc st_hcd st_hcd_sh st_is st_issys st_note st_promo st_set st_show st_smpl st_subid stack statsby statsby_8 stbase stci stci_7 stcox stcox_estat stcox_fr stcox_fr_ll stcox_p stcox_sw stcoxkm stcoxkm_7 stcstat stcurv stcurve stcurve_7 stdes stem stepwise stereg stfill stgen stir stjoin stmc stmh stphplot stphplot_7 stphtest stphtest_7 stptime strate strate_7 streg streg_sw streset sts sts_7 stset stsplit stsum sttocc sttoct stvary stweib su suest suest_8 sum summ summa summar summari summariz summarize sunflower sureg survcurv survsum svar svar_p svmat svy svy_disp svy_dreg svy_est svy_est_7 svy_estat svy_get svy_gnbreg_p svy_head svy_header svy_heckman_p svy_heckprob_p svy_intreg_p svy_ivreg_p svy_logistic_p svy_logit_p svy_mlogit_p svy_nbreg_p svy_ologit_p svy_oprobit_p svy_poisson_p svy_probit_p svy_regress_p svy_sub svy_sub_7 svy_x svy_x_7 svy_x_p svydes svydes_8 svygen svygnbreg svyheckman svyheckprob svyintreg svyintreg_7 svyintrg svyivreg svylc svylog_p svylogit svymarkout svymarkout_8 svymean svymlog svymlogit svynbreg svyolog svyologit svyoprob svyoprobit svyopts svypois svypois_7 svypoisson svyprobit svyprobt svyprop svyprop_7 svyratio svyreg svyreg_p svyregress svyset svyset_7 svyset_8 svytab svytab_7 svytest svytotal sw sw_8 swcnreg swcox swereg swilk swlogis swlogit swologit swoprbt swpois swprobit swqreg swtobit swweib symmetry symmi symplot symplot_7 syntax sysdescribe sysdir sysuse szroeter ta tab tab1 tab2 tab_or tabd tabdi tabdis tabdisp tabi table tabodds tabodds_7 tabstat tabu tabul tabula tabulat tabulate te tempfile tempname tempvar tes test testnl testparm teststd tetrachoric time_it timer tis tob tobi tobit tobit_p tobit_sw token tokeni tokeniz tokenize tostring total translate translator transmap treat_ll treatr_p treatreg trim trnb_cons trnb_mean trpoiss_d2 trunc_ll truncr_p truncreg tsappend tset tsfill tsline tsline_ex tsreport tsrevar tsrline tsset tssmooth tsunab ttest ttesti tut_chk tut_wait tutorial tw tware_st two twoway twoway__fpfit_serset twoway__function_gen twoway__histogram_gen twoway__ipoint_serset twoway__ipoints_serset twoway__kdensity_gen twoway__lfit_serset twoway__normgen_gen twoway__pci_serset twoway__qfit_serset twoway__scatteri_serset twoway__sunflower_gen twoway_ksm_serset ty typ type typeof u unab unabbrev unabcmd update us use uselabel var var_mkcompanion var_p varbasic varfcast vargranger varirf varirf_add varirf_cgraph varirf_create varirf_ctable varirf_describe varirf_dir varirf_drop varirf_erase varirf_graph varirf_ograph varirf_rename varirf_set varirf_table varlist varlmar varnorm varsoc varstable varstable_w varstable_w2 varwle vce vec vec_fevd vec_mkphi vec_p vec_p_w vecirf_create veclmar veclmar_w vecnorm vecnorm_w vecrank vecstable verinst vers versi versio version view viewsource vif vwls wdatetof webdescribe webseek webuse weib1_lf weib2_lf weib_lf weib_lf0 weibhet_glf weibhet_glf_sh weibhet_glfa weibhet_glfa_sh weibhet_gp weibhet_ilf weibhet_ilf_sh weibhet_ilfa weibhet_ilfa_sh weibhet_ip weibu_sw weibul_p weibull weibull_c weibull_s weibullhet wh whelp whi which whil while wilc_st wilcoxon win wind windo window winexec wntestb wntestb_7 wntestq xchart xchart_7 xcorr xcorr_7 xi xi_6 xmlsav xmlsave xmluse xpose xsh xshe xshel xshell xt_iis xt_tis xtab_p xtabond xtbin_p xtclog xtcloglog xtcloglog_8 xtcloglog_d2 xtcloglog_pa_p xtcloglog_re_p xtcnt_p xtcorr xtdata xtdes xtfront_p xtfrontier xtgee xtgee_elink xtgee_estat xtgee_makeivar xtgee_p xtgee_plink xtgls xtgls_p xthaus xthausman xtht_p xthtaylor xtile xtint_p xtintreg xtintreg_8 xtintreg_d2 xtintreg_p xtivp_1 xtivp_2 xtivreg xtline xtline_ex xtlogit xtlogit_8 xtlogit_d2 xtlogit_fe_p xtlogit_pa_p xtlogit_re_p xtmixed xtmixed_estat xtmixed_p xtnb_fe xtnb_lf xtnbreg xtnbreg_pa_p xtnbreg_refe_p xtpcse xtpcse_p xtpois xtpoisson xtpoisson_d2 xtpoisson_pa_p xtpoisson_refe_p xtpred xtprobit xtprobit_8 xtprobit_d2 xtprobit_re_p xtps_fe xtps_lf xtps_ren xtps_ren_8 xtrar_p xtrc xtrc_p xtrchh xtrefe_p xtreg xtreg_be xtreg_fe xtreg_ml xtreg_pa_p xtreg_re xtregar xtrere_p xtset xtsf_ll xtsf_llti xtsum xttab xttest0 xttobit xttobit_8 xttobit_p xttrans yx yxview__barlike_draw yxview_area_draw yxview_bar_draw yxview_dot_draw yxview_dropline_draw yxview_function_draw yxview_iarrow_draw yxview_ilabels_draw yxview_normal_draw yxview_pcarrow_draw yxview_pcbarrow_draw yxview_pccapsym_draw yxview_pcscatter_draw yxview_pcspike_draw yxview_rarea_draw yxview_rbar_draw yxview_rbarm_draw yxview_rcap_draw yxview_rcapsym_draw yxview_rconnected_draw yxview_rline_draw yxview_rscatter_draw yxview_rspike_draw yxview_spike_draw yxview_sunflower_draw zap_s zinb zinb_llf zinb_plf zip zip_llf zip_p zip_plf zt_ct_5 zt_hc_5 zt_hcd_5 zt_is_5 zt_iss_5 zt_sho_5 zt_smp_5 ztbase_5 ztcox_5 ztdes_5 ztereg_5 ztfill_5 ztgen_5 ztir_5 ztjoin_5 ztnb ztnb_p ztp ztp_p zts_5 ztset_5 ztspli_5 ztsum_5 zttoct_5 ztvary_5 ztweib_5',
        contains: [{
            className: 'label',
            variants: [{
                begin: "\\$\\{?[a-zA-Z0-9_]+\\}?"
            }, {
                begin: "`[a-zA-Z0-9_]+'"
            }

            ]
        }, {
            className: 'string',
            variants: [{
                begin: '`"[^\r\n]*?"\''
            }, {
                begin: '"[^\r\n"]*"'
            }]
        },

            {
                className: 'literal',
                variants: [{
                    begin: '\\b(abs|acos|asin|atan|atan2|atanh|ceil|cloglog|comb|cos|digamma|exp|floor|invcloglog|invlogit|ln|lnfact|lnfactorial|lngamma|log|log10|max|min|mod|reldif|round|sign|sin|sqrt|sum|tan|tanh|trigamma|trunc|betaden|Binomial|binorm|binormal|chi2|chi2tail|dgammapda|dgammapdada|dgammapdadx|dgammapdx|dgammapdxdx|F|Fden|Ftail|gammaden|gammap|ibeta|invbinomial|invchi2|invchi2tail|invF|invFtail|invgammap|invibeta|invnchi2|invnFtail|invnibeta|invnorm|invnormal|invttail|nbetaden|nchi2|nFden|nFtail|nibeta|norm|normal|normalden|normd|npnchi2|tden|ttail|uniform|abbrev|char|index|indexnot|length|lower|ltrim|match|plural|proper|real|regexm|regexr|regexs|reverse|rtrim|string|strlen|strlower|strltrim|strmatch|strofreal|strpos|strproper|strreverse|strrtrim|strtrim|strupper|subinstr|subinword|substr|trim|upper|word|wordcount|_caller|autocode|byteorder|chop|clip|cond|e|epsdouble|epsfloat|group|inlist|inrange|irecode|matrix|maxbyte|maxdouble|maxfloat|maxint|maxlong|mi|minbyte|mindouble|minfloat|minint|minlong|missing|r|recode|replay|return|s|scalar|d|date|day|dow|doy|halfyear|mdy|month|quarter|week|year|d|daily|dofd|dofh|dofm|dofq|dofw|dofy|h|halfyearly|hofd|m|mofd|monthly|q|qofd|quarterly|tin|twithin|w|weekly|wofd|y|yearly|yh|ym|yofd|yq|yw|cholesky|colnumb|colsof|corr|det|diag|diag0cnt|el|get|hadamard|I|inv|invsym|issym|issymmetric|J|matmissing|matuniform|mreldif|nullmat|rownumb|rowsof|sweep|syminv|trace|vec|vecdiag)(?=\\(|$)'
                },]
            }, {
                className: 'comment',
                variants: [{
                    begin: '^[ \t]*\\*.*$'
                },
                    hljs.C_LINE_COMMENT_MODE,
                    hljs.C_BLOCK_COMMENT_MODE
                ]
            },

        ]
    };
});
hljs.registerLanguage('step21', function (hljs) {
    var STEP21_IDENT_RE = '[A-Z_][A-Z0-9_.]*';
    var STEP21_CLOSE_RE = 'END-ISO-10303-21;';
    var STEP21_KEYWORDS = {
        literal: '',
        built_in: '',
        keyword: 'HEADER ENDSEC DATA'
    };
    var STEP21_START = {
        className: 'preprocessor',
        begin: 'ISO-10303-21;',
        relevance: 10
    };
    var STEP21_CODE = [
        hljs.C_LINE_COMMENT_MODE, {
            className: 'comment',
            begin: '/\\*\\*!',
            end: '\\*/',
            contains: [hljs.PHRASAL_WORDS_MODE]
        },
        hljs.C_BLOCK_COMMENT_MODE,
        hljs.C_NUMBER_MODE,
        hljs.inherit(hljs.APOS_STRING_MODE, {
            illegal: null
        }),
        hljs.inherit(hljs.QUOTE_STRING_MODE, {
            illegal: null
        }), {
            className: 'string',
            begin: "'",
            end: "'"
        }, {
            className: 'label',
            variants: [{
                begin: '#',
                end: '\\d+',
                illegal: '\\W'
            }]
        }
    ];

    return {
        aliases: ['p21', 'step', 'stp'],
        case_insensitive: true, // STEP 21 is case insensitive in theory, in practice all non-comments are capitalized.
        lexemes: STEP21_IDENT_RE,
        keywords: STEP21_KEYWORDS,
        contains: [{
            className: 'preprocessor',
            begin: STEP21_CLOSE_RE,
            relevance: 10
        },
            STEP21_START
        ].concat(STEP21_CODE)
    };
});
hljs.registerLanguage('stylus', function (hljs) {

    var VARIABLE = {
        className: 'variable',
        begin: '\\$' + hljs.IDENT_RE
    };

    var HEX_COLOR = {
        className: 'hexcolor',
        begin: '#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})',
        relevance: 10
    };

    var AT_KEYWORDS = [
        'charset',
        'css',
        'debug',
        'extend',
        'font-face',
        'for',
        'import',
        'include',
        'media',
        'mixin',
        'page',
        'warn',
        'while'
    ];

    var PSEUDO_SELECTORS = [
        'after',
        'before',
        'first-letter',
        'first-line',
        'active',
        'first-child',
        'focus',
        'hover',
        'lang',
        'link',
        'visited'
    ];

    var TAGS = [
        'a',
        'abbr',
        'address',
        'article',
        'aside',
        'audio',
        'b',
        'blockquote',
        'body',
        'button',
        'canvas',
        'caption',
        'cite',
        'code',
        'dd',
        'del',
        'details',
        'dfn',
        'div',
        'dl',
        'dt',
        'em',
        'fieldset',
        'figcaption',
        'figure',
        'footer',
        'form',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'header',
        'hgroup',
        'html',
        'i',
        'iframe',
        'img',
        'input',
        'ins',
        'kbd',
        'label',
        'legend',
        'li',
        'mark',
        'menu',
        'nav',
        'object',
        'ol',
        'p',
        'q',
        'quote',
        'samp',
        'section',
        'span',
        'strong',
        'summary',
        'sup',
        'table',
        'tbody',
        'td',
        'textarea',
        'tfoot',
        'th',
        'thead',
        'time',
        'tr',
        'ul',
        'var',
        'video'
    ];

    var TAG_END = '[\\.\\s\\n\\[\\:,]';

    var ATTRIBUTES = [
        'align-content',
        'align-items',
        'align-self',
        'animation',
        'animation-delay',
        'animation-direction',
        'animation-duration',
        'animation-fill-mode',
        'animation-iteration-count',
        'animation-name',
        'animation-play-state',
        'animation-timing-function',
        'auto',
        'backface-visibility',
        'background',
        'background-attachment',
        'background-clip',
        'background-color',
        'background-image',
        'background-origin',
        'background-position',
        'background-repeat',
        'background-size',
        'border',
        'border-bottom',
        'border-bottom-color',
        'border-bottom-left-radius',
        'border-bottom-right-radius',
        'border-bottom-style',
        'border-bottom-width',
        'border-collapse',
        'border-color',
        'border-image',
        'border-image-outset',
        'border-image-repeat',
        'border-image-slice',
        'border-image-source',
        'border-image-width',
        'border-left',
        'border-left-color',
        'border-left-style',
        'border-left-width',
        'border-radius',
        'border-right',
        'border-right-color',
        'border-right-style',
        'border-right-width',
        'border-spacing',
        'border-style',
        'border-top',
        'border-top-color',
        'border-top-left-radius',
        'border-top-right-radius',
        'border-top-style',
        'border-top-width',
        'border-width',
        'bottom',
        'box-decoration-break',
        'box-shadow',
        'box-sizing',
        'break-after',
        'break-before',
        'break-inside',
        'caption-side',
        'clear',
        'clip',
        'clip-path',
        'color',
        'column-count',
        'column-fill',
        'column-gap',
        'column-rule',
        'column-rule-color',
        'column-rule-style',
        'column-rule-width',
        'column-span',
        'column-width',
        'columns',
        'content',
        'counter-increment',
        'counter-reset',
        'cursor',
        'direction',
        'display',
        'empty-cells',
        'filter',
        'flex',
        'flex-basis',
        'flex-direction',
        'flex-flow',
        'flex-grow',
        'flex-shrink',
        'flex-wrap',
        'float',
        'font',
        'font-family',
        'font-feature-settings',
        'font-kerning',
        'font-language-override',
        'font-size',
        'font-size-adjust',
        'font-stretch',
        'font-style',
        'font-variant',
        'font-variant-ligatures',
        'font-weight',
        'height',
        'hyphens',
        'icon',
        'image-orientation',
        'image-rendering',
        'image-resolution',
        'ime-mode',
        'inherit',
        'initial',
        'justify-content',
        'left',
        'letter-spacing',
        'line-height',
        'list-style',
        'list-style-image',
        'list-style-position',
        'list-style-type',
        'margin',
        'margin-bottom',
        'margin-left',
        'margin-right',
        'margin-top',
        'marks',
        'mask',
        'max-height',
        'max-width',
        'min-height',
        'min-width',
        'nav-down',
        'nav-index',
        'nav-left',
        'nav-right',
        'nav-up',
        'none',
        'normal',
        'object-fit',
        'object-position',
        'opacity',
        'order',
        'orphans',
        'outline',
        'outline-color',
        'outline-offset',
        'outline-style',
        'outline-width',
        'overflow',
        'overflow-wrap',
        'overflow-x',
        'overflow-y',
        'padding',
        'padding-bottom',
        'padding-left',
        'padding-right',
        'padding-top',
        'page-break-after',
        'page-break-before',
        'page-break-inside',
        'perspective',
        'perspective-origin',
        'pointer-events',
        'position',
        'quotes',
        'resize',
        'right',
        'tab-size',
        'table-layout',
        'text-align',
        'text-align-last',
        'text-decoration',
        'text-decoration-color',
        'text-decoration-line',
        'text-decoration-style',
        'text-indent',
        'text-overflow',
        'text-rendering',
        'text-shadow',
        'text-transform',
        'text-underline-position',
        'top',
        'transform',
        'transform-origin',
        'transform-style',
        'transition',
        'transition-delay',
        'transition-duration',
        'transition-property',
        'transition-timing-function',
        'unicode-bidi',
        'vertical-align',
        'visibility',
        'white-space',
        'widows',
        'width',
        'word-break',
        'word-spacing',
        'word-wrap',
        'z-index'
    ];

    // illegals
    var ILLEGAL = [
        '\\{',
        '\\}',
        '\\?',
        '(\\bReturn\\b)', // monkey
        '(\\bEnd\\b)', // monkey
        '(\\bend\\b)', // vbscript
        ';', // sql
        '#\\s', // markdown
        '\\*\\s', // markdown
        '===\\s', // markdown
        '\\|'
    ];

    return {
        aliases: ['styl'],
        case_insensitive: false,
        illegal: '(' + ILLEGAL.join('|') + ')',
        keywords: 'if else for in',
        contains: [

            // strings
            hljs.QUOTE_STRING_MODE,
            hljs.APOS_STRING_MODE,

            // comments
            hljs.C_LINE_COMMENT_MODE,
            hljs.C_BLOCK_COMMENT_MODE,

            // hex colors
            HEX_COLOR,

            // class tag
            {
                begin: '\\.[a-zA-Z][a-zA-Z0-9_-]*' + TAG_END,
                returnBegin: true,
                contains: [{
                    className: 'class',
                    begin: '\\.[a-zA-Z][a-zA-Z0-9_-]*'
                }]
            },

            // id tag
            {
                begin: '\\#[a-zA-Z][a-zA-Z0-9_-]*' + TAG_END,
                returnBegin: true,
                contains: [{
                    className: 'id',
                    begin: '\\#[a-zA-Z][a-zA-Z0-9_-]*'
                }]
            },

            // tags
            {
                begin: '\\b(' + TAGS.join('|') + ')' + TAG_END,
                returnBegin: true,
                contains: [{
                    className: 'tag',
                    begin: '\\b[a-zA-Z][a-zA-Z0-9_-]*'
                }]
            },

            // psuedo selectors
            {
                className: 'pseudo',
                begin: '&?:?:\\b(' + PSEUDO_SELECTORS.join('|') + ')' + TAG_END
            },

            // @ keywords
            {
                className: 'at_rule',
                begin: '\@(' + AT_KEYWORDS.join('|') + ')\\b'
            },

            // variables
            VARIABLE,

            // dimension
            hljs.CSS_NUMBER_MODE,

            // number
            hljs.NUMBER_MODE,

            // functions
            //  - only from beginning of line + whitespace
            {
                className: 'function',
                begin: '\\b[a-zA-Z][a-zA-Z0-9_\-]*\\(.*\\)',
                illegal: '[\\n]',
                returnBegin: true,
                contains: [{
                    className: 'title',
                    begin: '\\b[a-zA-Z][a-zA-Z0-9_\-]*'
                }, {
                    className: 'params',
                    begin: /\(/,
                    end: /\)/,
                    contains: [
                        HEX_COLOR,
                        VARIABLE,
                        hljs.APOS_STRING_MODE,
                        hljs.CSS_NUMBER_MODE,
                        hljs.NUMBER_MODE,
                        hljs.QUOTE_STRING_MODE
                    ]
                }]
            },

            // attributes
            //  - only from beginning of line + whitespace
            //  - must have whitespace after it
            {
                className: 'attribute',
                begin: '\\b(' + ATTRIBUTES.reverse().join('|') + ')\\b'
            }
        ]
    };
});
hljs.registerLanguage('swift', function (hljs) {
    var SWIFT_KEYWORDS = {
        keyword: 'class deinit enum extension func import init let protocol static ' +
        'struct subscript typealias var break case continue default do ' +
        'else fallthrough if in for return switch where while as dynamicType ' +
        'is new super self Self Type __COLUMN__ __FILE__ __FUNCTION__ ' +
        '__LINE__ associativity didSet get infix inout left mutating none ' +
        'nonmutating operator override postfix precedence prefix right set ' +
        'unowned unowned safe unsafe weak willSet',
        literal: 'true false nil',
        built_in: 'abs advance alignof alignofValue assert bridgeFromObjectiveC ' +
        'bridgeFromObjectiveCUnconditional bridgeToObjectiveC ' +
        'bridgeToObjectiveCUnconditional c contains count countElements ' +
        'countLeadingZeros debugPrint debugPrintln distance dropFirst dropLast dump ' +
        'encodeBitsAsWords enumerate equal false filter find getBridgedObjectiveCType ' +
        'getVaList indices insertionSort isBridgedToObjectiveC ' +
        'isBridgedVerbatimToObjectiveC isUniquelyReferenced join ' +
        'lexicographicalCompare map max maxElement min minElement nil numericCast ' +
        'partition posix print println quickSort reduce reflect reinterpretCast ' +
        'reverse roundUpToAlignment sizeof sizeofValue sort split startsWith strideof ' +
        'strideofValue swap swift toString transcode true underestimateCount ' +
        'unsafeReflect withExtendedLifetime withObjectAtPlusZero withUnsafePointer ' +
        'withUnsafePointerToObject withUnsafePointers withVaList'
    };

    var TYPE = {
        className: 'type',
        begin: '\\b[A-Z][\\w\']*',
        relevance: 0
    };
    var BLOCK_COMMENT = {
        className: 'comment',
        begin: '/\\*',
        end: '\\*/',
        contains: [hljs.PHRASAL_WORDS_MODE, 'self']
    };
    var SUBST = {
        className: 'subst',
        begin: /\\\(/,
        end: '\\)',
        keywords: SWIFT_KEYWORDS,
        contains: [] // assigned later
    };
    var NUMBERS = {
        className: 'number',
        begin: '\\b([\\d_]+(\\.[\\deE_]+)?|0x[a-fA-F0-9_]+(\\.[a-fA-F0-9p_]+)?|0b[01_]+|0o[0-7_]+)\\b',
        relevance: 0
    };
    var QUOTE_STRING_MODE = hljs.inherit(hljs.QUOTE_STRING_MODE, {
        contains: [SUBST, hljs.BACKSLASH_ESCAPE]
    });
    SUBST.contains = [NUMBERS];

    return {
        keywords: SWIFT_KEYWORDS,
        contains: [
            QUOTE_STRING_MODE,
            hljs.C_LINE_COMMENT_MODE,
            BLOCK_COMMENT,
            TYPE,
            NUMBERS, {
                className: 'func',
                beginKeywords: 'func',
                end: '{',
                excludeEnd: true,
                contains: [
                    hljs.inherit(hljs.TITLE_MODE, {
                        begin: /[A-Za-z$_][0-9A-Za-z$_]*/,
                        illegal: /\(/
                    }), {
                        className: 'generics',
                        begin: /</,
                        end: />/,
                        illegal: />/
                    }, {
                        className: 'params',
                        begin: /\(/,
                        end: /\)/,
                        keywords: SWIFT_KEYWORDS,
                        contains: [
                            'self',
                            NUMBERS,
                            QUOTE_STRING_MODE,
                            hljs.C_BLOCK_COMMENT_MODE, {
                                begin: ':'
                            } // relevance booster
                        ],
                        illegal: /["']/
                    }
                ],
                illegal: /\[|%/
            }, {
                className: 'class',
                beginKeywords: 'struct protocol class extension enum',
                keywords: SWIFT_KEYWORDS,
                end: '\\{',
                excludeEnd: true,
                contains: [
                    hljs.inherit(hljs.TITLE_MODE, {
                        begin: /[A-Za-z$_][0-9A-Za-z$_]*/
                    })
                ]
            }, {
                className: 'preprocessor', // @attributes
                begin: '(@assignment|@class_protocol|@exported|@final|@lazy|@noreturn|' +
                '@NSCopying|@NSManaged|@objc|@optional|@required|@auto_closure|' +
                '@noreturn|@IBAction|@IBDesignable|@IBInspectable|@IBOutlet|' +
                '@infix|@prefix|@postfix)'
            }
        ]
    };
});
hljs.registerLanguage('tcl', function (hljs) {
    return {
        aliases: ['tk'],
        keywords: 'after append apply array auto_execok auto_import auto_load auto_mkindex ' +
        'auto_mkindex_old auto_qualify auto_reset bgerror binary break catch cd chan clock ' +
        'close concat continue dde dict encoding eof error eval exec exit expr fblocked ' +
        'fconfigure fcopy file fileevent filename flush for foreach format gets glob global ' +
        'history http if incr info interp join lappend|10 lassign|10 lindex|10 linsert|10 list ' +
        'llength|10 load lrange|10 lrepeat|10 lreplace|10 lreverse|10 lsearch|10 lset|10 lsort|10 ' +
        'mathfunc mathop memory msgcat namespace open package parray pid pkg::create pkg_mkIndex ' +
        'platform platform::shell proc puts pwd read refchan regexp registry regsub|10 rename ' +
        'return safe scan seek set socket source split string subst switch tcl_endOfWord ' +
        'tcl_findLibrary tcl_startOfNextWord tcl_startOfPreviousWord tcl_wordBreakAfter ' +
        'tcl_wordBreakBefore tcltest tclvars tell time tm trace unknown unload unset update ' +
        'uplevel upvar variable vwait while',
        contains: [{
            className: 'comment',
            variants: [{
                begin: ';[ \\t]*#',
                end: '$'
            }, {
                begin: '^[ \\t]*#',
                end: '$'
            }]
        }, {
            beginKeywords: 'proc',
            end: '[\\{]',
            excludeEnd: true,
            contains: [{
                className: 'symbol',
                begin: '[ \\t\\n\\r]+(::)?[a-zA-Z_]((::)?[a-zA-Z0-9_])*',
                end: '[ \\t\\n\\r]',
                endsWithParent: true,
                excludeEnd: true
            }]
        }, {
            className: 'variable',
            excludeEnd: true,
            variants: [{
                begin: '\\$(\\{)?(::)?[a-zA-Z_]((::)?[a-zA-Z0-9_])*\\(([a-zA-Z0-9_])*\\)',
                end: '[^a-zA-Z0-9_\\}\\$]'
            }, {
                begin: '\\$(\\{)?(::)?[a-zA-Z_]((::)?[a-zA-Z0-9_])*',
                end: '(\\))?[^a-zA-Z0-9_\\}\\$]'
            }]
        }, {
            className: 'string',
            contains: [hljs.BACKSLASH_ESCAPE],
            variants: [
                hljs.inherit(hljs.APOS_STRING_MODE, {
                    illegal: null
                }),
                hljs.inherit(hljs.QUOTE_STRING_MODE, {
                    illegal: null
                })
            ]
        }, {
            className: 'number',
            variants: [hljs.BINARY_NUMBER_MODE, hljs.C_NUMBER_MODE]
        }]
    }
});
hljs.registerLanguage('tex', function (hljs) {
    var COMMAND1 = {
        className: 'command',
        begin: '\\\\[a-zA-Zа-яА-я]+[\\*]?'
    };
    var COMMAND2 = {
        className: 'command',
        begin: '\\\\[^a-zA-Zа-яА-я0-9]'
    };
    var SPECIAL = {
        className: 'special',
        begin: '[{}\\[\\]\\&#~]',
        relevance: 0
    };

    return {
        contains: [{ // parameter
            begin: '\\\\[a-zA-Zа-яА-я]+[\\*]? *= *-?\\d*\\.?\\d+(pt|pc|mm|cm|in|dd|cc|ex|em)?',
            returnBegin: true,
            contains: [
                COMMAND1, COMMAND2, {
                    className: 'number',
                    begin: ' *=',
                    end: '-?\\d*\\.?\\d+(pt|pc|mm|cm|in|dd|cc|ex|em)?',
                    excludeBegin: true
                }
            ],
            relevance: 10
        },
            COMMAND1, COMMAND2,
            SPECIAL, {
                className: 'formula',
                begin: '\\$\\$',
                end: '\\$\\$',
                contains: [COMMAND1, COMMAND2, SPECIAL],
                relevance: 0
            }, {
                className: 'formula',
                begin: '\\$',
                end: '\\$',
                contains: [COMMAND1, COMMAND2, SPECIAL],
                relevance: 0
            }, {
                className: 'comment',
                begin: '%',
                end: '$',
                relevance: 0
            }
        ]
    };
});
hljs.registerLanguage('thrift', function (hljs) {
    var BUILT_IN_TYPES = 'bool byte i16 i32 i64 double string binary';
    return {
        keywords: {
            keyword: 'namespace const typedef struct enum service exception void oneway set list map required optional',
            built_in: BUILT_IN_TYPES,
            literal: 'true false'
        },
        contains: [
            hljs.QUOTE_STRING_MODE,
            hljs.NUMBER_MODE,
            hljs.C_LINE_COMMENT_MODE,
            hljs.C_BLOCK_COMMENT_MODE, {
                className: 'class',
                beginKeywords: 'struct enum service exception',
                end: /\{/,
                illegal: /\n/,
                contains: [
                    hljs.inherit(hljs.TITLE_MODE, {
                        starts: {
                            endsWithParent: true,
                            excludeEnd: true
                        } // hack: eating everything after the first title
                    })
                ]
            }, {
                begin: '\\b(set|list|map)\\s*<',
                end: '>',
                keywords: BUILT_IN_TYPES,
                contains: ['self']
            }
        ]
    };
});
hljs.registerLanguage('twig', function (hljs) {
    var PARAMS = {
        className: 'params',
        begin: '\\(',
        end: '\\)'
    };

    var FUNCTION_NAMES = 'attribute block constant cycle date dump include ' +
        'max min parent random range source template_from_string';

    var FUNCTIONS = {
        className: 'function',
        beginKeywords: FUNCTION_NAMES,
        relevance: 0,
        contains: [
            PARAMS
        ]
    };

    var FILTER = {
        className: 'filter',
        begin: /\|[A-Za-z]+:?/,
        keywords: 'abs batch capitalize convert_encoding date date_modify default ' +
        'escape first format join json_encode keys last length lower ' +
        'merge nl2br number_format raw replace reverse round slice sort split ' +
        'striptags title trim upper url_encode',
        contains: [
            FUNCTIONS
        ]
    };

    var TAGS = 'autoescape block do embed extends filter flush for ' +
        'if import include macro sandbox set spaceless use verbatim';

    TAGS = TAGS + ' ' + TAGS.split(' ').map(function (t) {
        return 'end' + t
    }).join(' ');

    return {
        aliases: ['craftcms'],
        case_insensitive: true,
        subLanguage: 'xml',
        subLanguageMode: 'continuous',
        contains: [{
            className: 'comment',
            begin: /\{#/,
            end: /#}/
        }, {
            className: 'template_tag',
            begin: /\{%/,
            end: /%}/,
            keywords: TAGS,
            contains: [FILTER, FUNCTIONS]
        }, {
            className: 'variable',
            begin: /\{\{/,
            end: /}}/,
            contains: [FILTER, FUNCTIONS]
        }]
    };
});
hljs.registerLanguage('typescript', function (hljs) {
    return {
        aliases: ['ts'],
        keywords: {
            keyword: 'in if for while finally var new function|0 do return void else break catch ' +
            'instanceof with throw case default try this switch continue typeof delete ' +
            'let yield const class public private get set super interface extends' +
            'static constructor implements enum export import declare type protected',
            literal: 'true false null undefined NaN Infinity',
            built_in: 'eval isFinite isNaN parseFloat parseInt decodeURI decodeURIComponent ' +
            'encodeURI encodeURIComponent escape unescape Object Function Boolean Error ' +
            'EvalError InternalError RangeError ReferenceError StopIteration SyntaxError ' +
            'TypeError URIError Number Math Date String RegExp Array Float32Array ' +
            'Float64Array Int16Array Int32Array Int8Array Uint16Array Uint32Array ' +
            'Uint8Array Uint8ClampedArray ArrayBuffer DataView JSON Intl arguments require ' +
            'module console window document any number boolean string void'
        },
        contains: [{
            className: 'pi',
            begin: /^\s*('|")use strict('|")/,
            relevance: 0
        },
            hljs.APOS_STRING_MODE,
            hljs.QUOTE_STRING_MODE,
            hljs.C_LINE_COMMENT_MODE,
            hljs.C_BLOCK_COMMENT_MODE,
            hljs.C_NUMBER_MODE, { // "value" container
                begin: '(' + hljs.RE_STARTERS_RE + '|\\b(case|return|throw)\\b)\\s*',
                keywords: 'return throw case',
                contains: [
                    hljs.C_LINE_COMMENT_MODE,
                    hljs.C_BLOCK_COMMENT_MODE,
                    hljs.REGEXP_MODE, { // E4X
                        begin: /</,
                        end: />;/,
                        relevance: 0,
                        subLanguage: 'xml'
                    }
                ],
                relevance: 0
            }, {
                className: 'function',
                beginKeywords: 'function',
                end: /\{/,
                excludeEnd: true,
                contains: [
                    hljs.inherit(hljs.TITLE_MODE, {
                        begin: /[A-Za-z$_][0-9A-Za-z$_]*/
                    }), {
                        className: 'params',
                        begin: /\(/,
                        end: /\)/,
                        contains: [
                            hljs.C_LINE_COMMENT_MODE,
                            hljs.C_BLOCK_COMMENT_MODE
                        ],
                        illegal: /["'\(]/
                    }
                ],
                illegal: /\[|%/,
                relevance: 0 // () => {} is more typical in TypeScript
            }, {
                className: 'constructor',
                beginKeywords: 'constructor',
                end: /\{/,
                excludeEnd: true,
                relevance: 10
            }, {
                className: 'module',
                beginKeywords: 'module',
                end: /\{/,
                excludeEnd: true
            }, {
                className: 'interface',
                beginKeywords: 'interface',
                end: /\{/,
                excludeEnd: true
            }, {
                begin: /\$[(.]/ // relevance booster for a pattern common to JS libs: `$(something)` and `$.something`
            }, {
                begin: '\\.' + hljs.IDENT_RE,
                relevance: 0 // hack: prevents detection of keywords after dots
            }
        ]
    };
});
hljs.registerLanguage('vala', function (hljs) {
    return {
        keywords: {
            keyword: // Value types
            'char uchar unichar int uint long ulong short ushort int8 int16 int32 int64 uint8 ' +
            'uint16 uint32 uint64 float double bool struct enum string void ' +
                // Reference types
            'weak unowned owned ' +
                // Modifiers
            'async signal static abstract interface override ' +
                // Control Structures
            'while do for foreach else switch case break default return try catch ' +
                // Visibility
            'public private protected internal ' +
                // Other
            'using new this get set const stdout stdin stderr var',
            built_in: 'DBus GLib CCode Gee Object',
            literal: 'false true null'
        },
        contains: [{
            className: 'class',
            beginKeywords: 'class interface delegate namespace',
            end: '{',
            excludeEnd: true,
            illegal: '[^,:\\n\\s\\.]',
            contains: [
                hljs.UNDERSCORE_TITLE_MODE
            ]
        },
            hljs.C_LINE_COMMENT_MODE,
            hljs.C_BLOCK_COMMENT_MODE, {
                className: 'string',
                begin: '"""',
                end: '"""',
                relevance: 5
            },
            hljs.APOS_STRING_MODE,
            hljs.QUOTE_STRING_MODE,
            hljs.C_NUMBER_MODE, {
                className: 'preprocessor',
                begin: '^#',
                end: '$',
                relevance: 2
            }, {
                className: 'constant',
                begin: ' [A-Z_]+ ',
                relevance: 0
            }
        ]
    };
});
hljs.registerLanguage('vbnet', function (hljs) {
    return {
        aliases: ['vb'],
        case_insensitive: true,
        keywords: {
            keyword: 'addhandler addressof alias and andalso aggregate ansi as assembly auto binary by byref byval ' + /* a-b */
            'call case catch class compare const continue custom declare default delegate dim distinct do ' + /* c-d */
            'each equals else elseif end enum erase error event exit explicit finally for friend from function ' + /* e-f */
            'get global goto group handles if implements imports in inherits interface into is isfalse isnot istrue ' + /* g-i */
            'join key let lib like loop me mid mod module mustinherit mustoverride mybase myclass ' + /* j-m */
            'namespace narrowing new next not notinheritable notoverridable ' + /* n */
            'of off on operator option optional or order orelse overloads overridable overrides ' + /* o */
            'paramarray partial preserve private property protected public ' + /* p */
            'raiseevent readonly redim rem removehandler resume return ' + /* r */
            'select set shadows shared skip static step stop structure strict sub synclock ' + /* s */
            'take text then throw to try unicode until using when where while widening with withevents writeonly xor',
            /* t-x */
            built_in: 'boolean byte cbool cbyte cchar cdate cdec cdbl char cint clng cobj csbyte cshort csng cstr ctype ' + /* b-c */
            'date decimal directcast double gettype getxmlnamespace iif integer long object ' + /* d-o */
            'sbyte short single string trycast typeof uinteger ulong ushort',
            /* s-u */
            literal: 'true false nothing'
        },
        illegal: '//|{|}|endif|gosub|variant|wend',
        /* reserved deprecated keywords */
        contains: [
            hljs.inherit(hljs.QUOTE_STRING_MODE, {
                contains: [{
                    begin: '""'
                }]
            }), {
                className: 'comment',
                begin: '\'',
                end: '$',
                returnBegin: true,
                contains: [{
                    className: 'xmlDocTag',
                    begin: '\'\'\'|<!--|-->'
                }, {
                    className: 'xmlDocTag',
                    begin: '</?',
                    end: '>'
                }]
            },
            hljs.C_NUMBER_MODE, {
                className: 'preprocessor',
                begin: '#',
                end: '$',
                keywords: 'if else elseif end region externalsource'
            }
        ]
    };
});
hljs.registerLanguage('vbscript', function (hljs) {
    return {
        aliases: ['vbs'],
        case_insensitive: true,
        keywords: {
            keyword: 'call class const dim do loop erase execute executeglobal exit for each next function ' +
            'if then else on error option explicit new private property let get public randomize ' +
            'redim rem select case set stop sub while wend with end to elseif is or xor and not ' +
            'class_initialize class_terminate default preserve in me byval byref step resume goto',
            built_in: 'lcase month vartype instrrev ubound setlocale getobject rgb getref string ' +
            'weekdayname rnd dateadd monthname now day minute isarray cbool round formatcurrency ' +
            'conversions csng timevalue second year space abs clng timeserial fixs len asc ' +
            'isempty maths dateserial atn timer isobject filter weekday datevalue ccur isdate ' +
            'instr datediff formatdatetime replace isnull right sgn array snumeric log cdbl hex ' +
            'chr lbound msgbox ucase getlocale cos cdate cbyte rtrim join hour oct typename trim ' +
            'strcomp int createobject loadpicture tan formatnumber mid scriptenginebuildversion ' +
            'scriptengine split scriptengineminorversion cint sin datepart ltrim sqr ' +
            'scriptenginemajorversion time derived eval date formatpercent exp inputbox left ascw ' +
            'chrw regexp server response request cstr err',
            literal: 'true false null nothing empty'
        },
        illegal: '//',
        contains: [
            hljs.inherit(hljs.QUOTE_STRING_MODE, {
                contains: [{
                    begin: '""'
                }]
            }), {
                className: 'comment',
                begin: /'/,
                end: /$/,
                relevance: 0
            },
            hljs.C_NUMBER_MODE
        ]
    };
});
hljs.registerLanguage('vbscript-html', function (hljs) {
    return {
        subLanguage: 'xml',
        subLanguageMode: 'continuous',
        contains: [{
            begin: '<%',
            end: '%>',
            subLanguage: 'vbscript'
        }]
    };
});
hljs.registerLanguage('verilog', function (hljs) {
    return {
        aliases: ['v'],
        case_insensitive: true,
        keywords: {
            keyword: 'always and assign begin buf bufif0 bufif1 case casex casez cmos deassign ' +
            'default defparam disable edge else end endcase endfunction endmodule ' +
            'endprimitive endspecify endtable endtask event for force forever fork ' +
            'function if ifnone initial inout input join macromodule module nand ' +
            'negedge nmos nor not notif0 notif1 or output parameter pmos posedge ' +
            'primitive pulldown pullup rcmos release repeat rnmos rpmos rtran ' +
            'rtranif0 rtranif1 specify specparam table task timescale tran ' +
            'tranif0 tranif1 wait while xnor xor',
            typename: 'highz0 highz1 integer large medium pull0 pull1 real realtime reg ' +
            'scalared signed small strong0 strong1 supply0 supply0 supply1 supply1 ' +
            'time tri tri0 tri1 triand trior trireg vectored wand weak0 weak1 wire wor'
        },
        contains: [
            hljs.C_BLOCK_COMMENT_MODE,
            hljs.C_LINE_COMMENT_MODE,
            hljs.QUOTE_STRING_MODE, {
                className: 'number',
                begin: '\\b(\\d+\'(b|h|o|d|B|H|O|D))?[0-9xzXZ]+',
                contains: [hljs.BACKSLASH_ESCAPE],
                relevance: 0
            },
            /* ports in instances */
            {
                className: 'typename',
                begin: '\\.\\w+',
                relevance: 0
            },
            /* parameters to instances */
            {
                className: 'value',
                begin: '#\\((?!parameter).+\\)'
            },
            /* operators */
            {
                className: 'keyword',
                begin: '\\+|-|\\*|/|%|<|>|=|#|`|\\!|&|\\||@|:|\\^|~|\\{|\\}',
                relevance: 0
            }
        ]
    }; // return
});
hljs.registerLanguage('vhdl', function (hljs) {
    // Regular expression for VHDL numeric literals.

    // Decimal literal:
    var INTEGER_RE = '\\d(_|\\d)*';
    var EXPONENT_RE = '[eE][-+]?' + INTEGER_RE;
    var DECIMAL_LITERAL_RE = INTEGER_RE + '(\\.' + INTEGER_RE + ')?' + '(' + EXPONENT_RE + ')?';
    // Based literal:
    var BASED_INTEGER_RE = '\\w+';
    var BASED_LITERAL_RE = INTEGER_RE + '#' + BASED_INTEGER_RE + '(\\.' + BASED_INTEGER_RE + ')?' + '#' + '(' + EXPONENT_RE + ')?';

    var NUMBER_RE = '\\b(' + BASED_LITERAL_RE + '|' + DECIMAL_LITERAL_RE + ')';

    return {
        case_insensitive: true,
        keywords: {
            keyword: 'abs access after alias all and architecture array assert attribute begin block ' +
            'body buffer bus case component configuration constant context cover disconnect ' +
            'downto default else elsif end entity exit fairness file for force function generate ' +
            'generic group guarded if impure in inertial inout is label library linkage literal ' +
            'loop map mod nand new next nor not null of on open or others out package port ' +
            'postponed procedure process property protected pure range record register reject ' +
            'release rem report restrict restrict_guarantee return rol ror select sequence ' +
            'severity shared signal sla sll sra srl strong subtype then to transport type ' +
            'unaffected units until use variable vmode vprop vunit wait when while with xnor xor',
            typename: 'boolean bit character severity_level integer time delay_length natural positive ' +
            'string bit_vector file_open_kind file_open_status std_ulogic std_ulogic_vector ' +
            'std_logic std_logic_vector unsigned signed boolean_vector integer_vector ' +
            'real_vector time_vector'
        },
        illegal: '{',
        contains: [
            hljs.C_BLOCK_COMMENT_MODE, // VHDL-2008 block commenting.
            {
                className: 'comment',
                begin: '--',
                end: '$'
            },
            hljs.QUOTE_STRING_MODE, {
                className: 'number',
                begin: NUMBER_RE,
                relevance: 0
            }, {
                className: 'literal',
                begin: '\'(U|X|0|1|Z|W|L|H|-)\'',
                contains: [hljs.BACKSLASH_ESCAPE]
            }, {
                className: 'attribute',
                begin: '\'[A-Za-z](_?[A-Za-z0-9])*',
                contains: [hljs.BACKSLASH_ESCAPE]
            }
        ]
    };
});
hljs.registerLanguage('vim', function (hljs) {
    return {
        lexemes: /[!#@\w]+/,
        keywords: {
            keyword: //ex command
            // express version except: ! & * < = > !! # @ @@
            'N|0 P|0 X|0 a|0 ab abc abo al am an|0 ar arga argd arge argdo argg argl argu as au aug aun b|0 bN ba bad bd be bel bf bl bm bn bo bp br brea breaka breakd breakl bro bufdo buffers bun bw c|0 cN cNf ca cabc caddb cad caddf cal cat cb cc ccl cd ce cex cf cfir cgetb cgete cg changes chd che checkt cl cla clo cm cmapc cme cn cnew cnf cno cnorea cnoreme co col colo com comc comp con conf cope ' +
            'cp cpf cq cr cs cst cu cuna cunme cw d|0 delm deb debugg delc delf dif diffg diffo diffp diffpu diffs diffthis dig di dl dell dj dli do doautoa dp dr ds dsp e|0 ea ec echoe echoh echom echon el elsei em en endfo endf endt endw ene ex exe exi exu f|0 files filet fin fina fini fir fix fo foldc foldd folddoc foldo for fu g|0 go gr grepa gu gv ha h|0 helpf helpg helpt hi hid his i|0 ia iabc if ij il im imapc ' +
            'ime ino inorea inoreme int is isp iu iuna iunme j|0 ju k|0 keepa kee keepj lN lNf l|0 lad laddb laddf la lan lat lb lc lch lcl lcs le lefta let lex lf lfir lgetb lgete lg lgr lgrepa lh ll lla lli lmak lm lmapc lne lnew lnf ln loadk lo loc lockv lol lope lp lpf lr ls lt lu lua luad luaf lv lvimgrepa lw m|0 ma mak map mapc marks mat me menut mes mk mks mksp mkv mkvie mod mz mzf nbc nb nbs n|0 new nm nmapc nme nn nnoreme noa no noh norea noreme norm nu nun nunme ol o|0 om omapc ome on ono onoreme opt ou ounme ow p|0 ' +
            'profd prof pro promptr pc ped pe perld po popu pp pre prev ps pt ptN ptf ptj ptl ptn ptp ptr pts pu pw py3 python3 py3d py3f py pyd pyf q|0 quita qa r|0 rec red redi redr redraws reg res ret retu rew ri rightb rub rubyd rubyf rund ru rv s|0 sN san sa sal sav sb sbN sba sbf sbl sbm sbn sbp sbr scrip scripte scs se setf setg setl sf sfir sh sim sig sil sl sla sm smap smapc sme sn sni sno snor snoreme sor ' +
            'so spelld spe spelli spellr spellu spellw sp spr sre st sta startg startr star stopi stj sts sun sunm sunme sus sv sw sy synti sync t|0 tN tabN tabc tabdo tabe tabf tabfir tabl tabm tabnew ' +
            'tabn tabo tabp tabr tabs tab ta tags tc tcld tclf te tf th tj tl tm tn to tp tr try ts tu u|0 undoj undol una unh unl unlo unm unme uns up v|0 ve verb vert vim vimgrepa vi viu vie vm vmapc vme vne vn vnoreme vs vu vunme windo w|0 wN wa wh wi winc winp wn wp wq wqa ws wu wv x|0 xa xmapc xm xme xn xnoreme xu xunme y|0 z|0 ~ ' +
                // full version
            'Next Print append abbreviate abclear aboveleft all amenu anoremenu args argadd argdelete argedit argglobal arglocal argument ascii autocmd augroup aunmenu buffer bNext ball badd bdelete behave belowright bfirst blast bmodified bnext botright bprevious brewind break breakadd breakdel breaklist browse bunload ' +
            'bwipeout change cNext cNfile cabbrev cabclear caddbuffer caddexpr caddfile call catch cbuffer cclose center cexpr cfile cfirst cgetbuffer cgetexpr cgetfile chdir checkpath checktime clist clast close cmap cmapclear cmenu cnext cnewer cnfile cnoremap cnoreabbrev cnoremenu copy colder colorscheme command comclear compiler continue confirm copen cprevious cpfile cquit crewind cscope cstag cunmap ' +
            'cunabbrev cunmenu cwindow delete delmarks debug debuggreedy delcommand delfunction diffupdate diffget diffoff diffpatch diffput diffsplit digraphs display deletel djump dlist doautocmd doautoall deletep drop dsearch dsplit edit earlier echo echoerr echohl echomsg else elseif emenu endif endfor ' +
            'endfunction endtry endwhile enew execute exit exusage file filetype find finally finish first fixdel fold foldclose folddoopen folddoclosed foldopen function global goto grep grepadd gui gvim hardcopy help helpfind helpgrep helptags highlight hide history insert iabbrev iabclear ijump ilist imap ' +
            'imapclear imenu inoremap inoreabbrev inoremenu intro isearch isplit iunmap iunabbrev iunmenu join jumps keepalt keepmarks keepjumps lNext lNfile list laddexpr laddbuffer laddfile last language later lbuffer lcd lchdir lclose lcscope left leftabove lexpr lfile lfirst lgetbuffer lgetexpr lgetfile lgrep lgrepadd lhelpgrep llast llist lmake lmap lmapclear lnext lnewer lnfile lnoremap loadkeymap loadview ' +
            'lockmarks lockvar lolder lopen lprevious lpfile lrewind ltag lunmap luado luafile lvimgrep lvimgrepadd lwindow move mark make mapclear match menu menutranslate messages mkexrc mksession mkspell mkvimrc mkview mode mzscheme mzfile nbclose nbkey nbsart next nmap nmapclear nmenu nnoremap ' +
            'nnoremenu noautocmd noremap nohlsearch noreabbrev noremenu normal number nunmap nunmenu oldfiles open omap omapclear omenu only onoremap onoremenu options ounmap ounmenu ownsyntax print profdel profile promptfind promptrepl pclose pedit perl perldo pop popup ppop preserve previous psearch ptag ptNext ' +
            'ptfirst ptjump ptlast ptnext ptprevious ptrewind ptselect put pwd py3do py3file python pydo pyfile quit quitall qall read recover redo redir redraw redrawstatus registers resize retab return rewind right rightbelow ruby rubydo rubyfile rundo runtime rviminfo substitute sNext sandbox sargument sall saveas sbuffer sbNext sball sbfirst sblast sbmodified sbnext sbprevious sbrewind scriptnames scriptencoding ' +
            'scscope set setfiletype setglobal setlocal sfind sfirst shell simalt sign silent sleep slast smagic smapclear smenu snext sniff snomagic snoremap snoremenu sort source spelldump spellgood spellinfo spellrepall spellundo spellwrong split sprevious srewind stop stag startgreplace startreplace ' +
            'startinsert stopinsert stjump stselect sunhide sunmap sunmenu suspend sview swapname syntax syntime syncbind tNext tabNext tabclose tabedit tabfind tabfirst tablast tabmove tabnext tabonly tabprevious tabrewind tag tcl tcldo tclfile tearoff tfirst throw tjump tlast tmenu tnext topleft tprevious ' + 'trewind tselect tunmenu undo undojoin undolist unabbreviate unhide unlet unlockvar unmap unmenu unsilent update vglobal version verbose vertical vimgrep vimgrepadd visual viusage view vmap vmapclear vmenu vnew ' +
            'vnoremap vnoremenu vsplit vunmap vunmenu write wNext wall while winsize wincmd winpos wnext wprevious wqall wsverb wundo wviminfo xit xall xmapclear xmap xmenu xnoremap xnoremenu xunmap xunmenu yank',
            built_in: //built in func
            'abs acos add and append argc argidx argv asin atan atan2 browse browsedir bufexists buflisted bufloaded bufname bufnr bufwinnr byte2line byteidx call ceil changenr char2nr cindent clearmatches col complete complete_add complete_check confirm copy cos cosh count cscope_connection cursor ' +
            'deepcopy delete did_filetype diff_filler diff_hlID empty escape eval eventhandler executable exists exp expand extend feedkeys filereadable filewritable filter finddir findfile float2nr floor fmod fnameescape fnamemodify foldclosed foldclosedend foldlevel foldtext foldtextresult foreground function ' +
            'garbagecollect get getbufline getbufvar getchar getcharmod getcmdline getcmdpos getcmdtype getcwd getfontname getfperm getfsize getftime getftype getline getloclist getmatches getpid getpos getqflist getreg getregtype gettabvar gettabwinvar getwinposx getwinposy getwinvar glob globpath has has_key ' +
            'haslocaldir hasmapto histadd histdel histget histnr hlexists hlID hostname iconv indent index input inputdialog inputlist inputrestore inputsave inputsecret insert invert isdirectory islocked items join keys len libcall libcallnr line line2byte lispindent localtime log log10 luaeval map maparg mapcheck ' +
            'match matchadd matcharg matchdelete matchend matchlist matchstr max min mkdir mode mzeval nextnonblank nr2char or pathshorten pow prevnonblank printf pumvisible py3eval pyeval range readfile reltime reltimestr remote_expr remote_foreground remote_peek remote_read remote_send remove rename repeat ' +
            'resolve reverse round screenattr screenchar screencol screenrow search searchdecl searchpair searchpairpos searchpos server2client serverlist setbufvar setcmdpos setline setloclist setmatches setpos setqflist setreg settabvar settabwinvar setwinvar sha256 shellescape shiftwidth simplify sin ' +
            'sinh sort soundfold spellbadword spellsuggest split sqrt str2float str2nr strchars strdisplaywidth strftime stridx string strlen strpart strridx strtrans strwidth submatch substitute synconcealed synID synIDattr ' +
            'synIDtrans synstack system tabpagebuflist tabpagenr tabpagewinnr tagfiles taglist tan tanh tempname tolower toupper tr trunc type undofile undotree values virtcol visualmode wildmenumode winbufnr wincol winheight winline winnr winrestcmd winrestview winsaveview winwidth writefile xor'
        },
        illegal: /[{:]/,
        contains: [
            hljs.NUMBER_MODE,
            hljs.APOS_STRING_MODE, {
                className: 'string',
                // quote with escape, comment as quote
                begin: /"((\\")|[^"\n])*("|\n)/
            }, {
                className: 'variable',
                begin: /[bwtglsav]:[\w\d_]*/
            }, {
                className: 'function',
                beginKeywords: 'function function!',
                end: '$',
                relevance: 0,
                contains: [
                    hljs.TITLE_MODE, {
                        className: 'params',
                        begin: '\\(',
                        end: '\\)'
                    }
                ]
            }
        ]
    };
});
hljs.registerLanguage('x86asm', function (hljs) {
    return {
        case_insensitive: true,
        lexemes: '\\.?' + hljs.IDENT_RE,
        keywords: {
            keyword: 'lock rep repe repz repne repnz xaquire xrelease bnd nobnd ' +
            'aaa aad aam aas adc add and arpl bb0_reset bb1_reset bound bsf bsr bswap bt btc btr bts call cbw cdq cdqe clc cld cli clts cmc cmp cmpsb cmpsd cmpsq cmpsw cmpxchg cmpxchg486 cmpxchg8b cmpxchg16b cpuid cpu_read cpu_write cqo cwd cwde daa das dec div dmint emms enter equ f2xm1 fabs fadd faddp fbld fbstp fchs fclex fcmovb fcmovbe fcmove fcmovnb fcmovnbe fcmovne fcmovnu fcmovu fcom fcomi fcomip fcomp fcompp fcos fdecstp fdisi fdiv fdivp fdivr fdivrp femms feni ffree ffreep fiadd ficom ficomp fidiv fidivr fild fimul fincstp finit fist fistp fisttp fisub fisubr fld fld1 fldcw fldenv fldl2e fldl2t fldlg2 fldln2 fldpi fldz fmul fmulp fnclex fndisi fneni fninit fnop fnsave fnstcw fnstenv fnstsw fpatan fprem fprem1 fptan frndint frstor fsave fscale fsetpm fsin fsincos fsqrt fst fstcw fstenv fstp fstsw fsub fsubp fsubr fsubrp ftst fucom fucomi fucomip fucomp fucompp fxam fxch fxtract fyl2x fyl2xp1 hlt ibts icebp idiv imul in inc incbin insb insd insw int int01 int1 int03 int3 into invd invpcid invlpg invlpga iret iretd iretq iretw jcxz jecxz jrcxz jmp jmpe lahf lar lds lea leave les lfence lfs lgdt lgs lidt lldt lmsw loadall loadall286 lodsb lodsd lodsq lodsw loop loope loopne loopnz loopz lsl lss ltr mfence monitor mov movd movq movsb movsd movsq movsw movsx movsxd movzx mul mwait neg nop not or out outsb outsd outsw packssdw packsswb packuswb paddb paddd paddsb paddsiw paddsw paddusb paddusw paddw pand pandn pause paveb pavgusb pcmpeqb pcmpeqd pcmpeqw pcmpgtb pcmpgtd pcmpgtw pdistib pf2id pfacc pfadd pfcmpeq pfcmpge pfcmpgt pfmax pfmin pfmul pfrcp pfrcpit1 pfrcpit2 pfrsqit1 pfrsqrt pfsub pfsubr pi2fd pmachriw pmaddwd pmagw pmulhriw pmulhrwa pmulhrwc pmulhw pmullw pmvgezb pmvlzb pmvnzb pmvzb pop popa popad popaw popf popfd popfq popfw por prefetch prefetchw pslld psllq psllw psrad psraw psrld psrlq psrlw psubb psubd psubsb psubsiw psubsw psubusb psubusw psubw punpckhbw punpckhdq punpckhwd punpcklbw punpckldq punpcklwd push pusha pushad pushaw pushf pushfd pushfq pushfw pxor rcl rcr rdshr rdmsr rdpmc rdtsc rdtscp ret retf retn rol ror rdm rsdc rsldt rsm rsts sahf sal salc sar sbb scasb scasd scasq scasw sfence sgdt shl shld shr shrd sidt sldt skinit smi smint smintold smsw stc std sti stosb stosd stosq stosw str sub svdc svldt svts swapgs syscall sysenter sysexit sysret test ud0 ud1 ud2b ud2 ud2a umov verr verw fwait wbinvd wrshr wrmsr xadd xbts xchg xlatb xlat xor cmove cmovz cmovne cmovnz cmova cmovnbe cmovae cmovnb cmovb cmovnae cmovbe cmovna cmovg cmovnle cmovge cmovnl cmovl cmovnge cmovle cmovng cmovc cmovnc cmovo cmovno cmovs cmovns cmovp cmovpe cmovnp cmovpo je jz jne jnz ja jnbe jae jnb jb jnae jbe jna jg jnle jge jnl jl jnge jle jng jc jnc jo jno js jns jpo jnp jpe jp sete setz setne setnz seta setnbe setae setnb setnc setb setnae setcset setbe setna setg setnle setge setnl setl setnge setle setng sets setns seto setno setpe setp setpo setnp addps addss andnps andps cmpeqps cmpeqss cmpleps cmpless cmpltps cmpltss cmpneqps cmpneqss cmpnleps cmpnless cmpnltps cmpnltss cmpordps cmpordss cmpunordps cmpunordss cmpps cmpss comiss cvtpi2ps cvtps2pi cvtsi2ss cvtss2si cvttps2pi cvttss2si divps divss ldmxcsr maxps maxss minps minss movaps movhps movlhps movlps movhlps movmskps movntps movss movups mulps mulss orps rcpps rcpss rsqrtps rsqrtss shufps sqrtps sqrtss stmxcsr subps subss ucomiss unpckhps unpcklps xorps fxrstor fxrstor64 fxsave fxsave64 xgetbv xsetbv xsave xsave64 xsaveopt xsaveopt64 xrstor xrstor64 prefetchnta prefetcht0 prefetcht1 prefetcht2 maskmovq movntq pavgb pavgw pextrw pinsrw pmaxsw pmaxub pminsw pminub pmovmskb pmulhuw psadbw pshufw pf2iw pfnacc pfpnacc pi2fw pswapd maskmovdqu clflush movntdq movnti movntpd movdqa movdqu movdq2q movq2dq paddq pmuludq pshufd pshufhw pshuflw pslldq psrldq psubq punpckhqdq punpcklqdq addpd addsd andnpd andpd cmpeqpd cmpeqsd cmplepd cmplesd cmpltpd cmpltsd cmpneqpd cmpneqsd cmpnlepd cmpnlesd cmpnltpd cmpnltsd cmpordpd cmpordsd cmpunordpd cmpunordsd cmppd comisd cvtdq2pd cvtdq2ps cvtpd2dq cvtpd2pi cvtpd2ps cvtpi2pd cvtps2dq cvtps2pd cvtsd2si cvtsd2ss cvtsi2sd cvtss2sd cvttpd2pi cvttpd2dq cvttps2dq cvttsd2si divpd divsd maxpd maxsd minpd minsd movapd movhpd movlpd movmskpd movupd mulpd mulsd orpd shufpd sqrtpd sqrtsd subpd subsd ucomisd unpckhpd unpcklpd xorpd addsubpd addsubps haddpd haddps hsubpd hsubps lddqu movddup movshdup movsldup clgi stgi vmcall vmclear vmfunc vmlaunch vmload vmmcall vmptrld vmptrst vmread vmresume vmrun vmsave vmwrite vmxoff vmxon invept invvpid pabsb pabsw pabsd palignr phaddw phaddd phaddsw phsubw phsubd phsubsw pmaddubsw pmulhrsw pshufb psignb psignw psignd extrq insertq movntsd movntss lzcnt blendpd blendps blendvpd blendvps dppd dpps extractps insertps movntdqa mpsadbw packusdw pblendvb pblendw pcmpeqq pextrb pextrd pextrq phminposuw pinsrb pinsrd pinsrq pmaxsb pmaxsd pmaxud pmaxuw pminsb pminsd pminud pminuw pmovsxbw pmovsxbd pmovsxbq pmovsxwd pmovsxwq pmovsxdq pmovzxbw pmovzxbd pmovzxbq pmovzxwd pmovzxwq pmovzxdq pmuldq pmulld ptest roundpd roundps roundsd roundss crc32 pcmpestri pcmpestrm pcmpistri pcmpistrm pcmpgtq popcnt getsec pfrcpv pfrsqrtv movbe aesenc aesenclast aesdec aesdeclast aesimc aeskeygenassist vaesenc vaesenclast vaesdec vaesdeclast vaesimc vaeskeygenassist vaddpd vaddps vaddsd vaddss vaddsubpd vaddsubps vandpd vandps vandnpd vandnps vblendpd vblendps vblendvpd vblendvps vbroadcastss vbroadcastsd vbroadcastf128 vcmpeq_ospd vcmpeqpd vcmplt_ospd vcmpltpd vcmple_ospd vcmplepd vcmpunord_qpd vcmpunordpd vcmpneq_uqpd vcmpneqpd vcmpnlt_uspd vcmpnltpd vcmpnle_uspd vcmpnlepd vcmpord_qpd vcmpordpd vcmpeq_uqpd vcmpnge_uspd vcmpngepd vcmpngt_uspd vcmpngtpd vcmpfalse_oqpd vcmpfalsepd vcmpneq_oqpd vcmpge_ospd vcmpgepd vcmpgt_ospd vcmpgtpd vcmptrue_uqpd vcmptruepd vcmplt_oqpd vcmple_oqpd vcmpunord_spd vcmpneq_uspd vcmpnlt_uqpd vcmpnle_uqpd vcmpord_spd vcmpeq_uspd vcmpnge_uqpd vcmpngt_uqpd vcmpfalse_ospd vcmpneq_ospd vcmpge_oqpd vcmpgt_oqpd vcmptrue_uspd vcmppd vcmpeq_osps vcmpeqps vcmplt_osps vcmpltps vcmple_osps vcmpleps vcmpunord_qps vcmpunordps vcmpneq_uqps vcmpneqps vcmpnlt_usps vcmpnltps vcmpnle_usps vcmpnleps vcmpord_qps vcmpordps vcmpeq_uqps vcmpnge_usps vcmpngeps vcmpngt_usps vcmpngtps vcmpfalse_oqps vcmpfalseps vcmpneq_oqps vcmpge_osps vcmpgeps vcmpgt_osps vcmpgtps vcmptrue_uqps vcmptrueps vcmplt_oqps vcmple_oqps vcmpunord_sps vcmpneq_usps vcmpnlt_uqps vcmpnle_uqps vcmpord_sps vcmpeq_usps vcmpnge_uqps vcmpngt_uqps vcmpfalse_osps vcmpneq_osps vcmpge_oqps vcmpgt_oqps vcmptrue_usps vcmpps vcmpeq_ossd vcmpeqsd vcmplt_ossd vcmpltsd vcmple_ossd vcmplesd vcmpunord_qsd vcmpunordsd vcmpneq_uqsd vcmpneqsd vcmpnlt_ussd vcmpnltsd vcmpnle_ussd vcmpnlesd vcmpord_qsd vcmpordsd vcmpeq_uqsd vcmpnge_ussd vcmpngesd vcmpngt_ussd vcmpngtsd vcmpfalse_oqsd vcmpfalsesd vcmpneq_oqsd vcmpge_ossd vcmpgesd vcmpgt_ossd vcmpgtsd vcmptrue_uqsd vcmptruesd vcmplt_oqsd vcmple_oqsd vcmpunord_ssd vcmpneq_ussd vcmpnlt_uqsd vcmpnle_uqsd vcmpord_ssd vcmpeq_ussd vcmpnge_uqsd vcmpngt_uqsd vcmpfalse_ossd vcmpneq_ossd vcmpge_oqsd vcmpgt_oqsd vcmptrue_ussd vcmpsd vcmpeq_osss vcmpeqss vcmplt_osss vcmpltss vcmple_osss vcmpless vcmpunord_qss vcmpunordss vcmpneq_uqss vcmpneqss vcmpnlt_usss vcmpnltss vcmpnle_usss vcmpnless vcmpord_qss vcmpordss vcmpeq_uqss vcmpnge_usss vcmpngess vcmpngt_usss vcmpngtss vcmpfalse_oqss vcmpfalsess vcmpneq_oqss vcmpge_osss vcmpgess vcmpgt_osss vcmpgtss vcmptrue_uqss vcmptruess vcmplt_oqss vcmple_oqss vcmpunord_sss vcmpneq_usss vcmpnlt_uqss vcmpnle_uqss vcmpord_sss vcmpeq_usss vcmpnge_uqss vcmpngt_uqss vcmpfalse_osss vcmpneq_osss vcmpge_oqss vcmpgt_oqss vcmptrue_usss vcmpss vcomisd vcomiss vcvtdq2pd vcvtdq2ps vcvtpd2dq vcvtpd2ps vcvtps2dq vcvtps2pd vcvtsd2si vcvtsd2ss vcvtsi2sd vcvtsi2ss vcvtss2sd vcvtss2si vcvttpd2dq vcvttps2dq vcvttsd2si vcvttss2si vdivpd vdivps vdivsd vdivss vdppd vdpps vextractf128 vextractps vhaddpd vhaddps vhsubpd vhsubps vinsertf128 vinsertps vlddqu vldqqu vldmxcsr vmaskmovdqu vmaskmovps vmaskmovpd vmaxpd vmaxps vmaxsd vmaxss vminpd vminps vminsd vminss vmovapd vmovaps vmovd vmovq vmovddup vmovdqa vmovqqa vmovdqu vmovqqu vmovhlps vmovhpd vmovhps vmovlhps vmovlpd vmovlps vmovmskpd vmovmskps vmovntdq vmovntqq vmovntdqa vmovntpd vmovntps vmovsd vmovshdup vmovsldup vmovss vmovupd vmovups vmpsadbw vmulpd vmulps vmulsd vmulss vorpd vorps vpabsb vpabsw vpabsd vpacksswb vpackssdw vpackuswb vpackusdw vpaddb vpaddw vpaddd vpaddq vpaddsb vpaddsw vpaddusb vpaddusw vpalignr vpand vpandn vpavgb vpavgw vpblendvb vpblendw vpcmpestri vpcmpestrm vpcmpistri vpcmpistrm vpcmpeqb vpcmpeqw vpcmpeqd vpcmpeqq vpcmpgtb vpcmpgtw vpcmpgtd vpcmpgtq vpermilpd vpermilps vperm2f128 vpextrb vpextrw vpextrd vpextrq vphaddw vphaddd vphaddsw vphminposuw vphsubw vphsubd vphsubsw vpinsrb vpinsrw vpinsrd vpinsrq vpmaddwd vpmaddubsw vpmaxsb vpmaxsw vpmaxsd vpmaxub vpmaxuw vpmaxud vpminsb vpminsw vpminsd vpminub vpminuw vpminud vpmovmskb vpmovsxbw vpmovsxbd vpmovsxbq vpmovsxwd vpmovsxwq vpmovsxdq vpmovzxbw vpmovzxbd vpmovzxbq vpmovzxwd vpmovzxwq vpmovzxdq vpmulhuw vpmulhrsw vpmulhw vpmullw vpmulld vpmuludq vpmuldq vpor vpsadbw vpshufb vpshufd vpshufhw vpshuflw vpsignb vpsignw vpsignd vpslldq vpsrldq vpsllw vpslld vpsllq vpsraw vpsrad vpsrlw vpsrld vpsrlq vptest vpsubb vpsubw vpsubd vpsubq vpsubsb vpsubsw vpsubusb vpsubusw vpunpckhbw vpunpckhwd vpunpckhdq vpunpckhqdq vpunpcklbw vpunpcklwd vpunpckldq vpunpcklqdq vpxor vrcpps vrcpss vrsqrtps vrsqrtss vroundpd vroundps vroundsd vroundss vshufpd vshufps vsqrtpd vsqrtps vsqrtsd vsqrtss vstmxcsr vsubpd vsubps vsubsd vsubss vtestps vtestpd vucomisd vucomiss vunpckhpd vunpckhps vunpcklpd vunpcklps vxorpd vxorps vzeroall vzeroupper pclmullqlqdq pclmulhqlqdq pclmullqhqdq pclmulhqhqdq pclmulqdq vpclmullqlqdq vpclmulhqlqdq vpclmullqhqdq vpclmulhqhqdq vpclmulqdq vfmadd132ps vfmadd132pd vfmadd312ps vfmadd312pd vfmadd213ps vfmadd213pd vfmadd123ps vfmadd123pd vfmadd231ps vfmadd231pd vfmadd321ps vfmadd321pd vfmaddsub132ps vfmaddsub132pd vfmaddsub312ps vfmaddsub312pd vfmaddsub213ps vfmaddsub213pd vfmaddsub123ps vfmaddsub123pd vfmaddsub231ps vfmaddsub231pd vfmaddsub321ps vfmaddsub321pd vfmsub132ps vfmsub132pd vfmsub312ps vfmsub312pd vfmsub213ps vfmsub213pd vfmsub123ps vfmsub123pd vfmsub231ps vfmsub231pd vfmsub321ps vfmsub321pd vfmsubadd132ps vfmsubadd132pd vfmsubadd312ps vfmsubadd312pd vfmsubadd213ps vfmsubadd213pd vfmsubadd123ps vfmsubadd123pd vfmsubadd231ps vfmsubadd231pd vfmsubadd321ps vfmsubadd321pd vfnmadd132ps vfnmadd132pd vfnmadd312ps vfnmadd312pd vfnmadd213ps vfnmadd213pd vfnmadd123ps vfnmadd123pd vfnmadd231ps vfnmadd231pd vfnmadd321ps vfnmadd321pd vfnmsub132ps vfnmsub132pd vfnmsub312ps vfnmsub312pd vfnmsub213ps vfnmsub213pd vfnmsub123ps vfnmsub123pd vfnmsub231ps vfnmsub231pd vfnmsub321ps vfnmsub321pd vfmadd132ss vfmadd132sd vfmadd312ss vfmadd312sd vfmadd213ss vfmadd213sd vfmadd123ss vfmadd123sd vfmadd231ss vfmadd231sd vfmadd321ss vfmadd321sd vfmsub132ss vfmsub132sd vfmsub312ss vfmsub312sd vfmsub213ss vfmsub213sd vfmsub123ss vfmsub123sd vfmsub231ss vfmsub231sd vfmsub321ss vfmsub321sd vfnmadd132ss vfnmadd132sd vfnmadd312ss vfnmadd312sd vfnmadd213ss vfnmadd213sd vfnmadd123ss vfnmadd123sd vfnmadd231ss vfnmadd231sd vfnmadd321ss vfnmadd321sd vfnmsub132ss vfnmsub132sd vfnmsub312ss vfnmsub312sd vfnmsub213ss vfnmsub213sd vfnmsub123ss vfnmsub123sd vfnmsub231ss vfnmsub231sd vfnmsub321ss vfnmsub321sd rdfsbase rdgsbase rdrand wrfsbase wrgsbase vcvtph2ps vcvtps2ph adcx adox rdseed clac stac xstore xcryptecb xcryptcbc xcryptctr xcryptcfb xcryptofb montmul xsha1 xsha256 llwpcb slwpcb lwpval lwpins vfmaddpd vfmaddps vfmaddsd vfmaddss vfmaddsubpd vfmaddsubps vfmsubaddpd vfmsubaddps vfmsubpd vfmsubps vfmsubsd vfmsubss vfnmaddpd vfnmaddps vfnmaddsd vfnmaddss vfnmsubpd vfnmsubps vfnmsubsd vfnmsubss vfrczpd vfrczps vfrczsd vfrczss vpcmov vpcomb vpcomd vpcomq vpcomub vpcomud vpcomuq vpcomuw vpcomw vphaddbd vphaddbq vphaddbw vphadddq vphaddubd vphaddubq vphaddubw vphaddudq vphadduwd vphadduwq vphaddwd vphaddwq vphsubbw vphsubdq vphsubwd vpmacsdd vpmacsdqh vpmacsdql vpmacssdd vpmacssdqh vpmacssdql vpmacsswd vpmacssww vpmacswd vpmacsww vpmadcsswd vpmadcswd vpperm vprotb vprotd vprotq vprotw vpshab vpshad vpshaq vpshaw vpshlb vpshld vpshlq vpshlw vbroadcasti128 vpblendd vpbroadcastb vpbroadcastw vpbroadcastd vpbroadcastq vpermd vpermpd vpermps vpermq vperm2i128 vextracti128 vinserti128 vpmaskmovd vpmaskmovq vpsllvd vpsllvq vpsravd vpsrlvd vpsrlvq vgatherdpd vgatherqpd vgatherdps vgatherqps vpgatherdd vpgatherqd vpgatherdq vpgatherqq xabort xbegin xend xtest andn bextr blci blcic blsi blsic blcfill blsfill blcmsk blsmsk blsr blcs bzhi mulx pdep pext rorx sarx shlx shrx tzcnt tzmsk t1mskc valignd valignq vblendmpd vblendmps vbroadcastf32x4 vbroadcastf64x4 vbroadcasti32x4 vbroadcasti64x4 vcompresspd vcompressps vcvtpd2udq vcvtps2udq vcvtsd2usi vcvtss2usi vcvttpd2udq vcvttps2udq vcvttsd2usi vcvttss2usi vcvtudq2pd vcvtudq2ps vcvtusi2sd vcvtusi2ss vexpandpd vexpandps vextractf32x4 vextractf64x4 vextracti32x4 vextracti64x4 vfixupimmpd vfixupimmps vfixupimmsd vfixupimmss vgetexppd vgetexpps vgetexpsd vgetexpss vgetmantpd vgetmantps vgetmantsd vgetmantss vinsertf32x4 vinsertf64x4 vinserti32x4 vinserti64x4 vmovdqa32 vmovdqa64 vmovdqu32 vmovdqu64 vpabsq vpandd vpandnd vpandnq vpandq vpblendmd vpblendmq vpcmpltd vpcmpled vpcmpneqd vpcmpnltd vpcmpnled vpcmpd vpcmpltq vpcmpleq vpcmpneqq vpcmpnltq vpcmpnleq vpcmpq vpcmpequd vpcmpltud vpcmpleud vpcmpnequd vpcmpnltud vpcmpnleud vpcmpud vpcmpequq vpcmpltuq vpcmpleuq vpcmpnequq vpcmpnltuq vpcmpnleuq vpcmpuq vpcompressd vpcompressq vpermi2d vpermi2pd vpermi2ps vpermi2q vpermt2d vpermt2pd vpermt2ps vpermt2q vpexpandd vpexpandq vpmaxsq vpmaxuq vpminsq vpminuq vpmovdb vpmovdw vpmovqb vpmovqd vpmovqw vpmovsdb vpmovsdw vpmovsqb vpmovsqd vpmovsqw vpmovusdb vpmovusdw vpmovusqb vpmovusqd vpmovusqw vpord vporq vprold vprolq vprolvd vprolvq vprord vprorq vprorvd vprorvq vpscatterdd vpscatterdq vpscatterqd vpscatterqq vpsraq vpsravq vpternlogd vpternlogq vptestmd vptestmq vptestnmd vptestnmq vpxord vpxorq vrcp14pd vrcp14ps vrcp14sd vrcp14ss vrndscalepd vrndscaleps vrndscalesd vrndscaless vrsqrt14pd vrsqrt14ps vrsqrt14sd vrsqrt14ss vscalefpd vscalefps vscalefsd vscalefss vscatterdpd vscatterdps vscatterqpd vscatterqps vshuff32x4 vshuff64x2 vshufi32x4 vshufi64x2 kandnw kandw kmovw knotw kortestw korw kshiftlw kshiftrw kunpckbw kxnorw kxorw vpbroadcastmb2q vpbroadcastmw2d vpconflictd vpconflictq vplzcntd vplzcntq vexp2pd vexp2ps vrcp28pd vrcp28ps vrcp28sd vrcp28ss vrsqrt28pd vrsqrt28ps vrsqrt28sd vrsqrt28ss vgatherpf0dpd vgatherpf0dps vgatherpf0qpd vgatherpf0qps vgatherpf1dpd vgatherpf1dps vgatherpf1qpd vgatherpf1qps vscatterpf0dpd vscatterpf0dps vscatterpf0qpd vscatterpf0qps vscatterpf1dpd vscatterpf1dps vscatterpf1qpd vscatterpf1qps prefetchwt1 bndmk bndcl bndcu bndcn bndmov bndldx bndstx sha1rnds4 sha1nexte sha1msg1 sha1msg2 sha256rnds2 sha256msg1 sha256msg2 hint_nop0 hint_nop1 hint_nop2 hint_nop3 hint_nop4 hint_nop5 hint_nop6 hint_nop7 hint_nop8 hint_nop9 hint_nop10 hint_nop11 hint_nop12 hint_nop13 hint_nop14 hint_nop15 hint_nop16 hint_nop17 hint_nop18 hint_nop19 hint_nop20 hint_nop21 hint_nop22 hint_nop23 hint_nop24 hint_nop25 hint_nop26 hint_nop27 hint_nop28 hint_nop29 hint_nop30 hint_nop31 hint_nop32 hint_nop33 hint_nop34 hint_nop35 hint_nop36 hint_nop37 hint_nop38 hint_nop39 hint_nop40 hint_nop41 hint_nop42 hint_nop43 hint_nop44 hint_nop45 hint_nop46 hint_nop47 hint_nop48 hint_nop49 hint_nop50 hint_nop51 hint_nop52 hint_nop53 hint_nop54 hint_nop55 hint_nop56 hint_nop57 hint_nop58 hint_nop59 hint_nop60 hint_nop61 hint_nop62 hint_nop63',
            literal: // Instruction pointer
            'ip eip rip ' +
                // 8-bit registers
            'al ah bl bh cl ch dl dh sil dil bpl spl r8b r9b r10b r11b r12b r13b r14b r15b ' +
                // 16-bit registers
            'ax bx cx dx si di bp sp r8w r9w r10w r11w r12w r13w r14w r15w ' +
                // 32-bit registers
            'eax ebx ecx edx esi edi ebp esp eip r8d r9d r10d r11d r12d r13d r14d r15d ' +
                // 64-bit registers
            'rax rbx rcx rdx rsi rdi rbp rsp r8 r9 r10 r11 r12 r13 r14 r15 ' +
                // Segment registers
            'cs ds es fs gs ss ' +
                // Floating point stack registers
            'st st0 st1 st2 st3 st4 st5 st6 st7 ' +
                // MMX Registers
            'mm0 mm1 mm2 mm3 mm4 mm5 mm6 mm7 ' +
                // SSE registers
            'xmm0  xmm1  xmm2  xmm3  xmm4  xmm5  xmm6  xmm7  xmm8  xmm9 xmm10  xmm11 xmm12 xmm13 xmm14 xmm15 ' +
            'xmm16 xmm17 xmm18 xmm19 xmm20 xmm21 xmm22 xmm23 xmm24 xmm25 xmm26 xmm27 xmm28 xmm29 xmm30 xmm31 ' +
                // AVX registers
            'ymm0  ymm1  ymm2  ymm3  ymm4  ymm5  ymm6  ymm7  ymm8  ymm9 ymm10  ymm11 ymm12 ymm13 ymm14 ymm15 ' +
            'ymm16 ymm17 ymm18 ymm19 ymm20 ymm21 ymm22 ymm23 ymm24 ymm25 ymm26 ymm27 ymm28 ymm29 ymm30 ymm31 ' +
                // AVX-512F registers
            'zmm0  zmm1  zmm2  zmm3  zmm4  zmm5  zmm6  zmm7  zmm8  zmm9 zmm10  zmm11 zmm12 zmm13 zmm14 zmm15 ' +
            'zmm16 zmm17 zmm18 zmm19 zmm20 zmm21 zmm22 zmm23 zmm24 zmm25 zmm26 zmm27 zmm28 zmm29 zmm30 zmm31 ' +
                // AVX-512F mask registers
            'k0 k1 k2 k3 k4 k5 k6 k7 ' +
                // Bound (MPX) register
            'bnd0 bnd1 bnd2 bnd3 ' +
                // Special register
            'cr0 cr1 cr2 cr3 cr4 cr8 dr0 dr1 dr2 dr3 dr8 tr3 tr4 tr5 tr6 tr7 ' +
                // NASM altreg package
            'r0 r1 r2 r3 r4 r5 r6 r7 r0b r1b r2b r3b r4b r5b r6b r7b ' +
            'r0w r1w r2w r3w r4w r5w r6w r7w r0d r1d r2d r3d r4d r5d r6d r7d ' +
            'r0h r1h r2h r3h ' +
            'r0l r1l r2l r3l r4l r5l r6l r7l r8l r9l r10l r11l r12l r13l r14l r15l',

            pseudo: 'db dw dd dq dt ddq do dy dz ' +
            'resb resw resd resq rest resdq reso resy resz ' +
            'incbin equ times',

            preprocessor: '%define %xdefine %+ %undef %defstr %deftok %assign %strcat %strlen %substr %rotate %elif %else %endif ' +
            '%ifmacro %ifctx %ifidn %ifidni %ifid %ifnum %ifstr %iftoken %ifempty %ifenv %error %warning %fatal %rep ' +
            '%endrep %include %push %pop %repl %pathsearch %depend %use %arg %stacksize %local %line %comment %endcomment ' +
            '.nolist ' +
            'byte word dword qword nosplit rel abs seg wrt strict near far a32 ptr ' +
            '__FILE__ __LINE__ __SECT__  __BITS__ __OUTPUT_FORMAT__ __DATE__ __TIME__ __DATE_NUM__ __TIME_NUM__ ' +
            '__UTC_DATE__ __UTC_TIME__ __UTC_DATE_NUM__ __UTC_TIME_NUM__  __PASS__ struc endstruc istruc at iend ' +
            'align alignb sectalign daz nodaz up down zero default option assume public ',

            built_in: 'bits use16 use32 use64 default section segment absolute extern global common cpu float ' +
            '__utf16__ __utf16le__ __utf16be__ __utf32__ __utf32le__ __utf32be__ ' +
            '__float8__ __float16__ __float32__ __float64__ __float80m__ __float80e__ __float128l__ __float128h__ ' +
            '__Infinity__ __QNaN__ __SNaN__ Inf NaN QNaN SNaN float8 float16 float32 float64 float80m float80e ' +
            'float128l float128h __FLOAT_DAZ__ __FLOAT_ROUND__ __FLOAT__'
        },
        contains: [{
            className: 'comment',
            begin: ';',
            end: '$',
            relevance: 0
        },
            // Float number and x87 BCD
            {
                className: 'number',
                begin: '\\b(?:([0-9][0-9_]*)?\\.[0-9_]*(?:[eE][+-]?[0-9_]+)?|(0[Xx])?[0-9][0-9_]*\\.?[0-9_]*(?:[pP](?:[+-]?[0-9_]+)?)?)\\b',
                relevance: 0
            },
            // Hex number in $
            {
                className: 'number',
                begin: '\\$[0-9][0-9A-Fa-f]*',
                relevance: 0
            },
            // Number in H,X,D,T,Q,O,B,Y suffix
            {
                className: 'number',
                begin: '\\b(?:[0-9A-Fa-f][0-9A-Fa-f_]*[HhXx]|[0-9][0-9_]*[DdTt]?|[0-7][0-7_]*[QqOo]|[0-1][0-1_]*[BbYy])\\b'
            },
            // Number in H,X,D,T,Q,O,B,Y prefix
            {
                className: 'number',
                begin: '\\b(?:0[HhXx][0-9A-Fa-f_]+|0[DdTt][0-9_]+|0[QqOo][0-7_]+|0[BbYy][0-1_]+)\\b'
            },
            // Double quote string
            hljs.QUOTE_STRING_MODE,
            // Single-quoted string
            {
                className: 'string',
                begin: '\'',
                end: '[^\\\\]\'',
                relevance: 0
            },
            // Backquoted string
            {
                className: 'string',
                begin: '`',
                end: '[^\\\\]`',
                relevance: 0
            },
            // Section name
            {
                className: 'string',
                begin: '\\.[A-Za-z0-9]+',
                relevance: 0
            },
            // Global label and local label
            {
                className: 'label',
                begin: '^\\s*[A-Za-z._?][A-Za-z0-9_$#@~.?]*(:|\\s+label)',
                relevance: 0
            },
            // Macro-local label
            {
                className: 'label',
                begin: '^\\s*%%[A-Za-z0-9_$#@~.?]*:',
                relevance: 0
            },
            // Macro parameter
            {
                className: 'argument',
                begin: '%[0-9]+',
                relevance: 0
            },
            // Macro parameter
            {
                className: 'built_in',
                begin: '%!\\S+',
                relevance: 0
            }
        ]
    };
});
hljs.registerLanguage('xl', function (hljs) {
    var BUILTIN_MODULES = 'ObjectLoader Animate MovieCredits Slides Filters Shading Materials LensFlare Mapping VLCAudioVideo StereoDecoder PointCloud NetworkAccess RemoteControl RegExp ChromaKey Snowfall NodeJS Speech Charts';

    var XL_KEYWORDS = {
        keyword: 'if then else do while until for loop import with is as where when by data constant',
        literal: 'true false nil',
        type: 'integer real text name boolean symbol infix prefix postfix block tree',
        built_in: 'in mod rem and or xor not abs sign floor ceil sqrt sin cos tan asin acos atan exp expm1 log log2 log10 log1p pi at',
        module: BUILTIN_MODULES,
        id: 'text_length text_range text_find text_replace contains page slide basic_slide title_slide title subtitle fade_in fade_out fade_at clear_color color line_color line_width texture_wrap texture_transform texture scale_?x scale_?y scale_?z? translate_?x translate_?y translate_?z? rotate_?x rotate_?y rotate_?z? rectangle circle ellipse sphere path line_to move_to quad_to curve_to theme background contents locally time mouse_?x mouse_?y mouse_buttons'
    };

    var XL_CONSTANT = {
        className: 'constant',
        begin: '[A-Z][A-Z_0-9]+',
        relevance: 0
    };
    var XL_VARIABLE = {
        className: 'variable',
        begin: '([A-Z][a-z_0-9]+)+',
        relevance: 0
    };
    var XL_ID = {
        className: 'id',
        begin: '[a-z][a-z_0-9]+',
        relevance: 0
    };

    var DOUBLE_QUOTE_TEXT = {
        className: 'string',
        begin: '"',
        end: '"',
        illegal: '\\n'
    };
    var SINGLE_QUOTE_TEXT = {
        className: 'string',
        begin: '\'',
        end: '\'',
        illegal: '\\n'
    };
    var LONG_TEXT = {
        className: 'string',
        begin: '<<',
        end: '>>'
    };
    var BASED_NUMBER = {
        className: 'number',
        begin: '[0-9]+#[0-9A-Z_]+(\\.[0-9-A-Z_]+)?#?([Ee][+-]?[0-9]+)?',
        relevance: 10
    };
    var IMPORT = {
        className: 'import',
        beginKeywords: 'import',
        end: '$',
        keywords: {
            keyword: 'import',
            module: BUILTIN_MODULES
        },
        relevance: 0,
        contains: [DOUBLE_QUOTE_TEXT]
    };
    var FUNCTION_DEFINITION = {
        className: 'function',
        begin: '[a-z].*->'
    };
    return {
        aliases: ['tao'],
        lexemes: /[a-zA-Z][a-zA-Z0-9_?]*/,
        keywords: XL_KEYWORDS,
        contains: [
            hljs.C_LINE_COMMENT_MODE,
            hljs.C_BLOCK_COMMENT_MODE,
            DOUBLE_QUOTE_TEXT,
            SINGLE_QUOTE_TEXT,
            LONG_TEXT,
            FUNCTION_DEFINITION,
            IMPORT,
            XL_CONSTANT,
            XL_VARIABLE,
            XL_ID,
            BASED_NUMBER,
            hljs.NUMBER_MODE
        ]
    };
});
// Source: public/javascripts/vendor/bootstrap/bootstrap.js
/*!
 * Bootstrap v3.3.2 (http://getbootstrap.com)
 * Copyright 2011-2015 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 */

if (typeof jQuery === 'undefined') {
  throw new Error('Bootstrap\'s JavaScript requires jQuery')
}

+function ($) {
var version = $.fn.jquery.split(' ')[0].split('.')
  if ((version[0] < 2 && version[1] < 9) || (version[0] == 1 && version[1] == 9 && version[2] < 1)) {
    throw new Error('Bootstrap\'s JavaScript requires jQuery version 1.9.1 or higher')
  }
}(jQuery);

/* ========================================================================
 * Bootstrap: transition.js v3.3.2
 * http://getbootstrap.com/javascript/#transitions
 * ========================================================================
 * Copyright 2011-2015 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
// CSS TRANSITION SUPPORT (Shoutout: http://www.modernizr.com/)
  // ============================================================

  function transitionEnd() {
    var el = document.createElement('bootstrap')

    var transEndEventNames = {
      WebkitTransition : 'webkitTransitionEnd',
      MozTransition    : 'transitionend',
      OTransition      : 'oTransitionEnd otransitionend',
      transition       : 'transitionend'
    }

    for (var name in transEndEventNames) {
      if (el.style[name] !== undefined) {
        return { end: transEndEventNames[name] }
      }
    }

    return false // explicit for ie8 (  ._.)
  }

  // http://blog.alexmaccaw.com/css-transitions
  $.fn.emulateTransitionEnd = function (duration) {
    var called = false
    var $el = this
    $(this).one('bsTransitionEnd', function () { called = true })
    var callback = function () { if (!called) $($el).trigger($.support.transition.end) }
    setTimeout(callback, duration)
    return this
  }

  $(function () {
    $.support.transition = transitionEnd()

    if (!$.support.transition) return

    $.event.special.bsTransitionEnd = {
      bindType: $.support.transition.end,
      delegateType: $.support.transition.end,
      handle: function (e) {
        if ($(e.target).is(this)) return e.handleObj.handler.apply(this, arguments)
      }
    }
  })

}(jQuery);

/* ========================================================================
 * Bootstrap: alert.js v3.3.2
 * http://getbootstrap.com/javascript/#alerts
 * ========================================================================
 * Copyright 2011-2015 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
// ALERT CLASS DEFINITION
  // ======================

  var dismiss = '[data-dismiss="alert"]'
  var Alert   = function (el) {
    $(el).on('click', dismiss, this.close)
  }

  Alert.VERSION = '3.3.2'

  Alert.TRANSITION_DURATION = 150

  Alert.prototype.close = function (e) {
    var $this    = $(this)
    var selector = $this.attr('data-target')

    if (!selector) {
      selector = $this.attr('href')
      selector = selector && selector.replace(/.*(?=#[^\s]*$)/, '') // strip for ie7
    }

    var $parent = $(selector)

    if (e) e.preventDefault()

    if (!$parent.length) {
      $parent = $this.closest('.alert')
    }

    $parent.trigger(e = $.Event('close.bs.alert'))

    if (e.isDefaultPrevented()) return

    $parent.removeClass('in')

    function removeElement() {
      // detach from parent, fire event then clean up data
      $parent.detach().trigger('closed.bs.alert').remove()
    }

    $.support.transition && $parent.hasClass('fade') ?
      $parent
        .one('bsTransitionEnd', removeElement)
        .emulateTransitionEnd(Alert.TRANSITION_DURATION) :
      removeElement()
  }


  // ALERT PLUGIN DEFINITION
  // =======================

  function Plugin(option) {
    return this.each(function () {
      var $this = $(this)
      var data  = $this.data('bs.alert')

      if (!data) $this.data('bs.alert', (data = new Alert(this)))
      if (typeof option == 'string') data[option].call($this)
    })
  }

  var old = $.fn.alert

  $.fn.alert             = Plugin
  $.fn.alert.Constructor = Alert


  // ALERT NO CONFLICT
  // =================

  $.fn.alert.noConflict = function () {
    $.fn.alert = old
    return this
  }


  // ALERT DATA-API
  // ==============

  $(document).on('click.bs.alert.data-api', dismiss, Alert.prototype.close)

}(jQuery);

/* ========================================================================
 * Bootstrap: button.js v3.3.2
 * http://getbootstrap.com/javascript/#buttons
 * ========================================================================
 * Copyright 2011-2015 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
// BUTTON PUBLIC CLASS DEFINITION
  // ==============================

  var Button = function (element, options) {
    this.$element  = $(element)
    this.options   = $.extend({}, Button.DEFAULTS, options)
    this.isLoading = false
  }

  Button.VERSION  = '3.3.2'

  Button.DEFAULTS = {
    loadingText: 'loading...'
  }

  Button.prototype.setState = function (state) {
    var d    = 'disabled'
    var $el  = this.$element
    var val  = $el.is('input') ? 'val' : 'html'
    var data = $el.data()

    state = state + 'Text'

    if (data.resetText == null) $el.data('resetText', $el[val]())

    // push to event loop to allow forms to submit
    setTimeout($.proxy(function () {
      $el[val](data[state] == null ? this.options[state] : data[state])

      if (state == 'loadingText') {
        this.isLoading = true
        $el.addClass(d).attr(d, d)
      } else if (this.isLoading) {
        this.isLoading = false
        $el.removeClass(d).removeAttr(d)
      }
    }, this), 0)
  }

  Button.prototype.toggle = function () {
    var changed = true
    var $parent = this.$element.closest('[data-toggle="buttons"]')

    if ($parent.length) {
      var $input = this.$element.find('input')
      if ($input.prop('type') == 'radio') {
        if ($input.prop('checked') && this.$element.hasClass('active')) changed = false
        else $parent.find('.active').removeClass('active')
      }
      if (changed) $input.prop('checked', !this.$element.hasClass('active')).trigger('change')
    } else {
      this.$element.attr('aria-pressed', !this.$element.hasClass('active'))
    }

    if (changed) this.$element.toggleClass('active')
  }


  // BUTTON PLUGIN DEFINITION
  // ========================

  function Plugin(option) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.button')
      var options = typeof option == 'object' && option

      if (!data) $this.data('bs.button', (data = new Button(this, options)))

      if (option == 'toggle') data.toggle()
      else if (option) data.setState(option)
    })
  }

  var old = $.fn.button

  $.fn.button             = Plugin
  $.fn.button.Constructor = Button


  // BUTTON NO CONFLICT
  // ==================

  $.fn.button.noConflict = function () {
    $.fn.button = old
    return this
  }


  // BUTTON DATA-API
  // ===============

  $(document)
    .on('click.bs.button.data-api', '[data-toggle^="button"]', function (e) {
      var $btn = $(e.target)
      if (!$btn.hasClass('btn')) $btn = $btn.closest('.btn')
      Plugin.call($btn, 'toggle')
      e.preventDefault()
    })
    .on('focus.bs.button.data-api blur.bs.button.data-api', '[data-toggle^="button"]', function (e) {
      $(e.target).closest('.btn').toggleClass('focus', /^focus(in)?$/.test(e.type))
    })

}(jQuery);

/* ========================================================================
 * Bootstrap: carousel.js v3.3.2
 * http://getbootstrap.com/javascript/#carousel
 * ========================================================================
 * Copyright 2011-2015 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
// CAROUSEL CLASS DEFINITION
  // =========================

  var Carousel = function (element, options) {
    this.$element    = $(element)
    this.$indicators = this.$element.find('.carousel-indicators')
    this.options     = options
    this.paused      =
    this.sliding     =
    this.interval    =
    this.$active     =
    this.$items      = null

    this.options.keyboard && this.$element.on('keydown.bs.carousel', $.proxy(this.keydown, this))

    this.options.pause == 'hover' && !('ontouchstart' in document.documentElement) && this.$element
      .on('mouseenter.bs.carousel', $.proxy(this.pause, this))
      .on('mouseleave.bs.carousel', $.proxy(this.cycle, this))
  }

  Carousel.VERSION  = '3.3.2'

  Carousel.TRANSITION_DURATION = 600

  Carousel.DEFAULTS = {
    interval: 5000,
    pause: 'hover',
    wrap: true,
    keyboard: true
  }

  Carousel.prototype.keydown = function (e) {
    if (/input|textarea/i.test(e.target.tagName)) return
    switch (e.which) {
      case 37: this.prev(); break
      case 39: this.next(); break
      default: return
    }

    e.preventDefault()
  }

  Carousel.prototype.cycle = function (e) {
    e || (this.paused = false)

    this.interval && clearInterval(this.interval)

    this.options.interval
      && !this.paused
      && (this.interval = setInterval($.proxy(this.next, this), this.options.interval))

    return this
  }

  Carousel.prototype.getItemIndex = function (item) {
    this.$items = item.parent().children('.item')
    return this.$items.index(item || this.$active)
  }

  Carousel.prototype.getItemForDirection = function (direction, active) {
    var activeIndex = this.getItemIndex(active)
    var willWrap = (direction == 'prev' && activeIndex === 0)
                || (direction == 'next' && activeIndex == (this.$items.length - 1))
    if (willWrap && !this.options.wrap) return active
    var delta = direction == 'prev' ? -1 : 1
    var itemIndex = (activeIndex + delta) % this.$items.length
    return this.$items.eq(itemIndex)
  }

  Carousel.prototype.to = function (pos) {
    var that        = this
    var activeIndex = this.getItemIndex(this.$active = this.$element.find('.item.active'))

    if (pos > (this.$items.length - 1) || pos < 0) return

    if (this.sliding)       return this.$element.one('slid.bs.carousel', function () { that.to(pos) }) // yes, "slid"
    if (activeIndex == pos) return this.pause().cycle()

    return this.slide(pos > activeIndex ? 'next' : 'prev', this.$items.eq(pos))
  }

  Carousel.prototype.pause = function (e) {
    e || (this.paused = true)

    if (this.$element.find('.next, .prev').length && $.support.transition) {
      this.$element.trigger($.support.transition.end)
      this.cycle(true)
    }

    this.interval = clearInterval(this.interval)

    return this
  }

  Carousel.prototype.next = function () {
    if (this.sliding) return
    return this.slide('next')
  }

  Carousel.prototype.prev = function () {
    if (this.sliding) return
    return this.slide('prev')
  }

  Carousel.prototype.slide = function (type, next) {
    var $active   = this.$element.find('.item.active')
    var $next     = next || this.getItemForDirection(type, $active)
    var isCycling = this.interval
    var direction = type == 'next' ? 'left' : 'right'
    var that      = this

    if ($next.hasClass('active')) return (this.sliding = false)

    var relatedTarget = $next[0]
    var slideEvent = $.Event('slide.bs.carousel', {
      relatedTarget: relatedTarget,
      direction: direction
    })
    this.$element.trigger(slideEvent)
    if (slideEvent.isDefaultPrevented()) return

    this.sliding = true

    isCycling && this.pause()

    if (this.$indicators.length) {
      this.$indicators.find('.active').removeClass('active')
      var $nextIndicator = $(this.$indicators.children()[this.getItemIndex($next)])
      $nextIndicator && $nextIndicator.addClass('active')
    }

    var slidEvent = $.Event('slid.bs.carousel', { relatedTarget: relatedTarget, direction: direction }) // yes, "slid"
    if ($.support.transition && this.$element.hasClass('slide')) {
      $next.addClass(type)
      $next[0].offsetWidth // force reflow
      $active.addClass(direction)
      $next.addClass(direction)
      $active
        .one('bsTransitionEnd', function () {
          $next.removeClass([type, direction].join(' ')).addClass('active')
          $active.removeClass(['active', direction].join(' '))
          that.sliding = false
          setTimeout(function () {
            that.$element.trigger(slidEvent)
          }, 0)
        })
        .emulateTransitionEnd(Carousel.TRANSITION_DURATION)
    } else {
      $active.removeClass('active')
      $next.addClass('active')
      this.sliding = false
      this.$element.trigger(slidEvent)
    }

    isCycling && this.cycle()

    return this
  }


  // CAROUSEL PLUGIN DEFINITION
  // ==========================

  function Plugin(option) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.carousel')
      var options = $.extend({}, Carousel.DEFAULTS, $this.data(), typeof option == 'object' && option)
      var action  = typeof option == 'string' ? option : options.slide

      if (!data) $this.data('bs.carousel', (data = new Carousel(this, options)))
      if (typeof option == 'number') data.to(option)
      else if (action) data[action]()
      else if (options.interval) data.pause().cycle()
    })
  }

  var old = $.fn.carousel

  $.fn.carousel             = Plugin
  $.fn.carousel.Constructor = Carousel


  // CAROUSEL NO CONFLICT
  // ====================

  $.fn.carousel.noConflict = function () {
    $.fn.carousel = old
    return this
  }


  // CAROUSEL DATA-API
  // =================

  var clickHandler = function (e) {
    var href
    var $this   = $(this)
    var $target = $($this.attr('data-target') || (href = $this.attr('href')) && href.replace(/.*(?=#[^\s]+$)/, '')) // strip for ie7
    if (!$target.hasClass('carousel')) return
    var options = $.extend({}, $target.data(), $this.data())
    var slideIndex = $this.attr('data-slide-to')
    if (slideIndex) options.interval = false

    Plugin.call($target, options)

    if (slideIndex) {
      $target.data('bs.carousel').to(slideIndex)
    }

    e.preventDefault()
  }

  $(document)
    .on('click.bs.carousel.data-api', '[data-slide]', clickHandler)
    .on('click.bs.carousel.data-api', '[data-slide-to]', clickHandler)

  $(window).on('load', function () {
    $('[data-ride="carousel"]').each(function () {
      var $carousel = $(this)
      Plugin.call($carousel, $carousel.data())
    })
  })

}(jQuery);

/* ========================================================================
 * Bootstrap: collapse.js v3.3.2
 * http://getbootstrap.com/javascript/#collapse
 * ========================================================================
 * Copyright 2011-2015 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
// COLLAPSE PUBLIC CLASS DEFINITION
  // ================================

  var Collapse = function (element, options) {
    this.$element      = $(element)
    this.options       = $.extend({}, Collapse.DEFAULTS, options)
    this.$trigger      = $(this.options.trigger).filter('[href="#' + element.id + '"], [data-target="#' + element.id + '"]')
    this.transitioning = null

    if (this.options.parent) {
      this.$parent = this.getParent()
    } else {
      this.addAriaAndCollapsedClass(this.$element, this.$trigger)
    }

    if (this.options.toggle) this.toggle()
  }

  Collapse.VERSION  = '3.3.2'

  Collapse.TRANSITION_DURATION = 350

  Collapse.DEFAULTS = {
    toggle: true,
    trigger: '[data-toggle="collapse"]'
  }

  Collapse.prototype.dimension = function () {
    var hasWidth = this.$element.hasClass('width')
    return hasWidth ? 'width' : 'height'
  }

  Collapse.prototype.show = function () {
    if (this.transitioning || this.$element.hasClass('in')) return

    var activesData
    var actives = this.$parent && this.$parent.children('.panel').children('.in, .collapsing')

    if (actives && actives.length) {
      activesData = actives.data('bs.collapse')
      if (activesData && activesData.transitioning) return
    }

    var startEvent = $.Event('show.bs.collapse')
    this.$element.trigger(startEvent)
    if (startEvent.isDefaultPrevented()) return

    if (actives && actives.length) {
      Plugin.call(actives, 'hide')
      activesData || actives.data('bs.collapse', null)
    }

    var dimension = this.dimension()

    this.$element
      .removeClass('collapse')
      .addClass('collapsing')[dimension](0)
      .attr('aria-expanded', true)

    this.$trigger
      .removeClass('collapsed')
      .attr('aria-expanded', true)

    this.transitioning = 1

    var complete = function () {
      this.$element
        .removeClass('collapsing')
        .addClass('collapse in')[dimension]('')
      this.transitioning = 0
      this.$element
        .trigger('shown.bs.collapse')
    }

    if (!$.support.transition) return complete.call(this)

    var scrollSize = $.camelCase(['scroll', dimension].join('-'))

    this.$element
      .one('bsTransitionEnd', $.proxy(complete, this))
      .emulateTransitionEnd(Collapse.TRANSITION_DURATION)[dimension](this.$element[0][scrollSize])
  }

  Collapse.prototype.hide = function () {
    if (this.transitioning || !this.$element.hasClass('in')) return

    var startEvent = $.Event('hide.bs.collapse')
    this.$element.trigger(startEvent)
    if (startEvent.isDefaultPrevented()) return

    var dimension = this.dimension()

    this.$element[dimension](this.$element[dimension]())[0].offsetHeight

    this.$element
      .addClass('collapsing')
      .removeClass('collapse in')
      .attr('aria-expanded', false)

    this.$trigger
      .addClass('collapsed')
      .attr('aria-expanded', false)

    this.transitioning = 1

    var complete = function () {
      this.transitioning = 0
      this.$element
        .removeClass('collapsing')
        .addClass('collapse')
        .trigger('hidden.bs.collapse')
    }

    if (!$.support.transition) return complete.call(this)

    this.$element
      [dimension](0)
      .one('bsTransitionEnd', $.proxy(complete, this))
      .emulateTransitionEnd(Collapse.TRANSITION_DURATION)
  }

  Collapse.prototype.toggle = function () {
    this[this.$element.hasClass('in') ? 'hide' : 'show']()
  }

  Collapse.prototype.getParent = function () {
    return $(this.options.parent)
      .find('[data-toggle="collapse"][data-parent="' + this.options.parent + '"]')
      .each($.proxy(function (i, element) {
        var $element = $(element)
        this.addAriaAndCollapsedClass(getTargetFromTrigger($element), $element)
      }, this))
      .end()
  }

  Collapse.prototype.addAriaAndCollapsedClass = function ($element, $trigger) {
    var isOpen = $element.hasClass('in')

    $element.attr('aria-expanded', isOpen)
    $trigger
      .toggleClass('collapsed', !isOpen)
      .attr('aria-expanded', isOpen)
  }

  function getTargetFromTrigger($trigger) {
    var href
    var target = $trigger.attr('data-target')
      || (href = $trigger.attr('href')) && href.replace(/.*(?=#[^\s]+$)/, '') // strip for ie7

    return $(target)
  }


  // COLLAPSE PLUGIN DEFINITION
  // ==========================

  function Plugin(option) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.collapse')
      var options = $.extend({}, Collapse.DEFAULTS, $this.data(), typeof option == 'object' && option)

      if (!data && options.toggle && option == 'show') options.toggle = false
      if (!data) $this.data('bs.collapse', (data = new Collapse(this, options)))
      if (typeof option == 'string') data[option]()
    })
  }

  var old = $.fn.collapse

  $.fn.collapse             = Plugin
  $.fn.collapse.Constructor = Collapse


  // COLLAPSE NO CONFLICT
  // ====================

  $.fn.collapse.noConflict = function () {
    $.fn.collapse = old
    return this
  }


  // COLLAPSE DATA-API
  // =================

  $(document).on('click.bs.collapse.data-api', '[data-toggle="collapse"]', function (e) {
    var $this   = $(this)

    if (!$this.attr('data-target')) e.preventDefault()

    var $target = getTargetFromTrigger($this)
    var data    = $target.data('bs.collapse')
    var option  = data ? 'toggle' : $.extend({}, $this.data(), { trigger: this })

    Plugin.call($target, option)
  })

}(jQuery);

/* ========================================================================
 * Bootstrap: dropdown.js v3.3.2
 * http://getbootstrap.com/javascript/#dropdowns
 * ========================================================================
 * Copyright 2011-2015 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
// DROPDOWN CLASS DEFINITION
  // =========================

  var backdrop = '.dropdown-backdrop'
  var toggle   = '[data-toggle="dropdown"]'
  var Dropdown = function (element) {
    $(element).on('click.bs.dropdown', this.toggle)
  }

  Dropdown.VERSION = '3.3.2'

  Dropdown.prototype.toggle = function (e) {
    var $this = $(this)

    if ($this.is('.disabled, :disabled')) return

    var $parent  = getParent($this)
    var isActive = $parent.hasClass('open')

    clearMenus()

    if (!isActive) {
      if ('ontouchstart' in document.documentElement && !$parent.closest('.navbar-nav').length) {
        // if mobile we use a backdrop because click events don't delegate
        $('<div class="dropdown-backdrop"/>').insertAfter($(this)).on('click', clearMenus)
      }

      var relatedTarget = { relatedTarget: this }
      $parent.trigger(e = $.Event('show.bs.dropdown', relatedTarget))

      if (e.isDefaultPrevented()) return

      $this
        .trigger('focus')
        .attr('aria-expanded', 'true')

      $parent
        .toggleClass('open')
        .trigger('shown.bs.dropdown', relatedTarget)
    }

    return false
  }

  Dropdown.prototype.keydown = function (e) {
    if (!/(38|40|27|32)/.test(e.which) || /input|textarea/i.test(e.target.tagName)) return

    var $this = $(this)

    e.preventDefault()
    e.stopPropagation()

    if ($this.is('.disabled, :disabled')) return

    var $parent  = getParent($this)
    var isActive = $parent.hasClass('open')

    if ((!isActive && e.which != 27) || (isActive && e.which == 27)) {
      if (e.which == 27) $parent.find(toggle).trigger('focus')
      return $this.trigger('click')
    }

    var desc = ' li:not(.divider):visible a'
    var $items = $parent.find('[role="menu"]' + desc + ', [role="listbox"]' + desc)

    if (!$items.length) return

    var index = $items.index(e.target)

    if (e.which == 38 && index > 0)                 index--                        // up
    if (e.which == 40 && index < $items.length - 1) index++                        // down
    if (!~index)                                      index = 0

    $items.eq(index).trigger('focus')
  }

  function clearMenus(e) {
    if (e && e.which === 3) return
    $(backdrop).remove()
    $(toggle).each(function () {
      var $this         = $(this)
      var $parent       = getParent($this)
      var relatedTarget = { relatedTarget: this }

      if (!$parent.hasClass('open')) return

      $parent.trigger(e = $.Event('hide.bs.dropdown', relatedTarget))

      if (e.isDefaultPrevented()) return

      $this.attr('aria-expanded', 'false')
      $parent.removeClass('open').trigger('hidden.bs.dropdown', relatedTarget)
    })
  }

  function getParent($this) {
    var selector = $this.attr('data-target')

    if (!selector) {
      selector = $this.attr('href')
      selector = selector && /#[A-Za-z]/.test(selector) && selector.replace(/.*(?=#[^\s]*$)/, '') // strip for ie7
    }

    var $parent = selector && $(selector)

    return $parent && $parent.length ? $parent : $this.parent()
  }


  // DROPDOWN PLUGIN DEFINITION
  // ==========================

  function Plugin(option) {
    return this.each(function () {
      var $this = $(this)
      var data  = $this.data('bs.dropdown')

      if (!data) $this.data('bs.dropdown', (data = new Dropdown(this)))
      if (typeof option == 'string') data[option].call($this)
    })
  }

  var old = $.fn.dropdown

  $.fn.dropdown             = Plugin
  $.fn.dropdown.Constructor = Dropdown


  // DROPDOWN NO CONFLICT
  // ====================

  $.fn.dropdown.noConflict = function () {
    $.fn.dropdown = old
    return this
  }


  // APPLY TO STANDARD DROPDOWN ELEMENTS
  // ===================================

  $(document)
    .on('click.bs.dropdown.data-api', clearMenus)
    .on('click.bs.dropdown.data-api', '.dropdown form', function (e) { e.stopPropagation() })
    .on('click.bs.dropdown.data-api', toggle, Dropdown.prototype.toggle)
    .on('keydown.bs.dropdown.data-api', toggle, Dropdown.prototype.keydown)
    .on('keydown.bs.dropdown.data-api', '[role="menu"]', Dropdown.prototype.keydown)
    .on('keydown.bs.dropdown.data-api', '[role="listbox"]', Dropdown.prototype.keydown)

}(jQuery);

/* ========================================================================
 * Bootstrap: modal.js v3.3.2
 * http://getbootstrap.com/javascript/#modals
 * ========================================================================
 * Copyright 2011-2015 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
// MODAL CLASS DEFINITION
  // ======================

  var Modal = function (element, options) {
    this.options        = options
    this.$body          = $(document.body)
    this.$element       = $(element)
    this.$backdrop      =
    this.isShown        = null
    this.scrollbarWidth = 0

    if (this.options.remote) {
      this.$element
        .find('.modal-content')
        .load(this.options.remote, $.proxy(function () {
          this.$element.trigger('loaded.bs.modal')
        }, this))
    }
  }

  Modal.VERSION  = '3.3.2'

  Modal.TRANSITION_DURATION = 300
  Modal.BACKDROP_TRANSITION_DURATION = 150

  Modal.DEFAULTS = {
    backdrop: true,
    keyboard: true,
    show: true
  }

  Modal.prototype.toggle = function (_relatedTarget) {
    return this.isShown ? this.hide() : this.show(_relatedTarget)
  }

  Modal.prototype.show = function (_relatedTarget) {
    var that = this
    var e    = $.Event('show.bs.modal', { relatedTarget: _relatedTarget })

    this.$element.trigger(e)

    if (this.isShown || e.isDefaultPrevented()) return

    this.isShown = true

    this.checkScrollbar()
    this.setScrollbar()
    this.$body.addClass('modal-open')

    this.escape()
    this.resize()

    this.$element.on('click.dismiss.bs.modal', '[data-dismiss="modal"]', $.proxy(this.hide, this))

    this.backdrop(function () {
      var transition = $.support.transition && that.$element.hasClass('fade')

      if (!that.$element.parent().length) {
        that.$element.appendTo(that.$body) // don't move modals dom position
      }

      that.$element
        .show()
        .scrollTop(0)

      if (that.options.backdrop) that.adjustBackdrop()
      that.adjustDialog()

      if (transition) {
        that.$element[0].offsetWidth // force reflow
      }

      that.$element
        .addClass('in')
        .attr('aria-hidden', false)

      that.enforceFocus()

      var e = $.Event('shown.bs.modal', { relatedTarget: _relatedTarget })

      transition ?
        that.$element.find('.modal-dialog') // wait for modal to slide in
          .one('bsTransitionEnd', function () {
            that.$element.trigger('focus').trigger(e)
          })
          .emulateTransitionEnd(Modal.TRANSITION_DURATION) :
        that.$element.trigger('focus').trigger(e)
    })
  }

  Modal.prototype.hide = function (e) {
    if (e) e.preventDefault()

    e = $.Event('hide.bs.modal')

    this.$element.trigger(e)

    if (!this.isShown || e.isDefaultPrevented()) return

    this.isShown = false

    this.escape()
    this.resize()

    $(document).off('focusin.bs.modal')

    this.$element
      .removeClass('in')
      .attr('aria-hidden', true)
      .off('click.dismiss.bs.modal')

    $.support.transition && this.$element.hasClass('fade') ?
      this.$element
        .one('bsTransitionEnd', $.proxy(this.hideModal, this))
        .emulateTransitionEnd(Modal.TRANSITION_DURATION) :
      this.hideModal()
  }

  Modal.prototype.enforceFocus = function () {
    $(document)
      .off('focusin.bs.modal') // guard against infinite focus loop
      .on('focusin.bs.modal', $.proxy(function (e) {
        if (this.$element[0] !== e.target && !this.$element.has(e.target).length) {
          this.$element.trigger('focus')
        }
      }, this))
  }

  Modal.prototype.escape = function () {
    if (this.isShown && this.options.keyboard) {
      this.$element.on('keydown.dismiss.bs.modal', $.proxy(function (e) {
        e.which == 27 && this.hide()
      }, this))
    } else if (!this.isShown) {
      this.$element.off('keydown.dismiss.bs.modal')
    }
  }

  Modal.prototype.resize = function () {
    if (this.isShown) {
      $(window).on('resize.bs.modal', $.proxy(this.handleUpdate, this))
    } else {
      $(window).off('resize.bs.modal')
    }
  }

  Modal.prototype.hideModal = function () {
    var that = this
    this.$element.hide()
    this.backdrop(function () {
      that.$body.removeClass('modal-open')
      that.resetAdjustments()
      that.resetScrollbar()
      that.$element.trigger('hidden.bs.modal')
    })
  }

  Modal.prototype.removeBackdrop = function () {
    this.$backdrop && this.$backdrop.remove()
    this.$backdrop = null
  }

  Modal.prototype.backdrop = function (callback) {
    var that = this
    var animate = this.$element.hasClass('fade') ? 'fade' : ''

    if (this.isShown && this.options.backdrop) {
      var doAnimate = $.support.transition && animate

      this.$backdrop = $('<div class="modal-backdrop ' + animate + '" />')
        .prependTo(this.$element)
        .on('click.dismiss.bs.modal', $.proxy(function (e) {
          if (e.target !== e.currentTarget) return
          this.options.backdrop == 'static'
            ? this.$element[0].focus.call(this.$element[0])
            : this.hide.call(this)
        }, this))

      if (doAnimate) this.$backdrop[0].offsetWidth // force reflow

      this.$backdrop.addClass('in')

      if (!callback) return

      doAnimate ?
        this.$backdrop
          .one('bsTransitionEnd', callback)
          .emulateTransitionEnd(Modal.BACKDROP_TRANSITION_DURATION) :
        callback()

    } else if (!this.isShown && this.$backdrop) {
      this.$backdrop.removeClass('in')

      var callbackRemove = function () {
        that.removeBackdrop()
        callback && callback()
      }
      $.support.transition && this.$element.hasClass('fade') ?
        this.$backdrop
          .one('bsTransitionEnd', callbackRemove)
          .emulateTransitionEnd(Modal.BACKDROP_TRANSITION_DURATION) :
        callbackRemove()

    } else if (callback) {
      callback()
    }
  }

  // these following methods are used to handle overflowing modals

  Modal.prototype.handleUpdate = function () {
    if (this.options.backdrop) this.adjustBackdrop()
    this.adjustDialog()
  }

  Modal.prototype.adjustBackdrop = function () {
    this.$backdrop
      .css('height', 0)
      .css('height', this.$element[0].scrollHeight)
  }

  Modal.prototype.adjustDialog = function () {
    var modalIsOverflowing = this.$element[0].scrollHeight > document.documentElement.clientHeight

    this.$element.css({
      paddingLeft:  !this.bodyIsOverflowing && modalIsOverflowing ? this.scrollbarWidth : '',
      paddingRight: this.bodyIsOverflowing && !modalIsOverflowing ? this.scrollbarWidth : ''
    })
  }

  Modal.prototype.resetAdjustments = function () {
    this.$element.css({
      paddingLeft: '',
      paddingRight: ''
    })
  }

  Modal.prototype.checkScrollbar = function () {
    this.bodyIsOverflowing = document.body.scrollHeight > document.documentElement.clientHeight
    this.scrollbarWidth = this.measureScrollbar()
  }

  Modal.prototype.setScrollbar = function () {
    var bodyPad = parseInt((this.$body.css('padding-right') || 0), 10)
    if (this.bodyIsOverflowing) this.$body.css('padding-right', bodyPad + this.scrollbarWidth)
  }

  Modal.prototype.resetScrollbar = function () {
    this.$body.css('padding-right', '')
  }

  Modal.prototype.measureScrollbar = function () { // thx walsh
    var scrollDiv = document.createElement('div')
    scrollDiv.className = 'modal-scrollbar-measure'
    this.$body.append(scrollDiv)
    var scrollbarWidth = scrollDiv.offsetWidth - scrollDiv.clientWidth
    this.$body[0].removeChild(scrollDiv)
    return scrollbarWidth
  }


  // MODAL PLUGIN DEFINITION
  // =======================

  function Plugin(option, _relatedTarget) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.modal')
      var options = $.extend({}, Modal.DEFAULTS, $this.data(), typeof option == 'object' && option)

      if (!data) $this.data('bs.modal', (data = new Modal(this, options)))
      if (typeof option == 'string') data[option](_relatedTarget)
      else if (options.show) data.show(_relatedTarget)
    })
  }

  var old = $.fn.modal

  $.fn.modal             = Plugin
  $.fn.modal.Constructor = Modal


  // MODAL NO CONFLICT
  // =================

  $.fn.modal.noConflict = function () {
    $.fn.modal = old
    return this
  }


  // MODAL DATA-API
  // ==============

  $(document).on('click.bs.modal.data-api', '[data-toggle="modal"]', function (e) {
    var $this   = $(this)
    var href    = $this.attr('href')
    var $target = $($this.attr('data-target') || (href && href.replace(/.*(?=#[^\s]+$)/, ''))) // strip for ie7
    var option  = $target.data('bs.modal') ? 'toggle' : $.extend({ remote: !/#/.test(href) && href }, $target.data(), $this.data())

    if ($this.is('a')) e.preventDefault()

    $target.one('show.bs.modal', function (showEvent) {
      if (showEvent.isDefaultPrevented()) return // only register focus restorer if modal will actually get shown
      $target.one('hidden.bs.modal', function () {
        $this.is(':visible') && $this.trigger('focus')
      })
    })
    Plugin.call($target, option, this)
  })

}(jQuery);

/* ========================================================================
 * Bootstrap: tooltip.js v3.3.2
 * http://getbootstrap.com/javascript/#tooltip
 * Inspired by the original jQuery.tipsy by Jason Frame
 * ========================================================================
 * Copyright 2011-2015 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
// TOOLTIP PUBLIC CLASS DEFINITION
  // ===============================

  var Tooltip = function (element, options) {
    this.type       =
    this.options    =
    this.enabled    =
    this.timeout    =
    this.hoverState =
    this.$element   = null

    this.init('tooltip', element, options)
  }

  Tooltip.VERSION  = '3.3.2'

  Tooltip.TRANSITION_DURATION = 150

  Tooltip.DEFAULTS = {
    animation: true,
    placement: 'top',
    selector: false,
    template: '<div class="tooltip" role="tooltip"><div class="tooltip-arrow"></div><div class="tooltip-inner"></div></div>',
    trigger: 'hover focus',
    title: '',
    delay: 0,
    html: false,
    container: false,
    viewport: {
      selector: 'body',
      padding: 0
    }
  }

  Tooltip.prototype.init = function (type, element, options) {
    this.enabled   = true
    this.type      = type
    this.$element  = $(element)
    this.options   = this.getOptions(options)
    this.$viewport = this.options.viewport && $(this.options.viewport.selector || this.options.viewport)

    var triggers = this.options.trigger.split(' ')

    for (var i = triggers.length; i--;) {
      var trigger = triggers[i]

      if (trigger == 'click') {
        this.$element.on('click.' + this.type, this.options.selector, $.proxy(this.toggle, this))
      } else if (trigger != 'manual') {
        var eventIn  = trigger == 'hover' ? 'mouseenter' : 'focusin'
        var eventOut = trigger == 'hover' ? 'mouseleave' : 'focusout'

        this.$element.on(eventIn  + '.' + this.type, this.options.selector, $.proxy(this.enter, this))
        this.$element.on(eventOut + '.' + this.type, this.options.selector, $.proxy(this.leave, this))
      }
    }

    this.options.selector ?
      (this._options = $.extend({}, this.options, { trigger: 'manual', selector: '' })) :
      this.fixTitle()
  }

  Tooltip.prototype.getDefaults = function () {
    return Tooltip.DEFAULTS
  }

  Tooltip.prototype.getOptions = function (options) {
    options = $.extend({}, this.getDefaults(), this.$element.data(), options)

    if (options.delay && typeof options.delay == 'number') {
      options.delay = {
        show: options.delay,
        hide: options.delay
      }
    }

    return options
  }

  Tooltip.prototype.getDelegateOptions = function () {
    var options  = {}
    var defaults = this.getDefaults()

    this._options && $.each(this._options, function (key, value) {
      if (defaults[key] != value) options[key] = value
    })

    return options
  }

  Tooltip.prototype.enter = function (obj) {
    var self = obj instanceof this.constructor ?
      obj : $(obj.currentTarget).data('bs.' + this.type)

    if (self && self.$tip && self.$tip.is(':visible')) {
      self.hoverState = 'in'
      return
    }

    if (!self) {
      self = new this.constructor(obj.currentTarget, this.getDelegateOptions())
      $(obj.currentTarget).data('bs.' + this.type, self)
    }

    clearTimeout(self.timeout)

    self.hoverState = 'in'

    if (!self.options.delay || !self.options.delay.show) return self.show()

    self.timeout = setTimeout(function () {
      if (self.hoverState == 'in') self.show()
    }, self.options.delay.show)
  }

  Tooltip.prototype.leave = function (obj) {
    var self = obj instanceof this.constructor ?
      obj : $(obj.currentTarget).data('bs.' + this.type)

    if (!self) {
      self = new this.constructor(obj.currentTarget, this.getDelegateOptions())
      $(obj.currentTarget).data('bs.' + this.type, self)
    }

    clearTimeout(self.timeout)

    self.hoverState = 'out'

    if (!self.options.delay || !self.options.delay.hide) return self.hide()

    self.timeout = setTimeout(function () {
      if (self.hoverState == 'out') self.hide()
    }, self.options.delay.hide)
  }

  Tooltip.prototype.show = function () {
    var e = $.Event('show.bs.' + this.type)

    if (this.hasContent() && this.enabled) {
      this.$element.trigger(e)

      var inDom = $.contains(this.$element[0].ownerDocument.documentElement, this.$element[0])
      if (e.isDefaultPrevented() || !inDom) return
      var that = this

      var $tip = this.tip()

      var tipId = this.getUID(this.type)

      this.setContent()
      $tip.attr('id', tipId)
      this.$element.attr('aria-describedby', tipId)

      if (this.options.animation) $tip.addClass('fade')

      var placement = typeof this.options.placement == 'function' ?
        this.options.placement.call(this, $tip[0], this.$element[0]) :
        this.options.placement

      var autoToken = /\s?auto?\s?/i
      var autoPlace = autoToken.test(placement)
      if (autoPlace) placement = placement.replace(autoToken, '') || 'top'

      $tip
        .detach()
        .css({ top: 0, left: 0, display: 'block' })
        .addClass(placement)
        .data('bs.' + this.type, this)

      this.options.container ? $tip.appendTo(this.options.container) : $tip.insertAfter(this.$element)

      var pos          = this.getPosition()
      var actualWidth  = $tip[0].offsetWidth
      var actualHeight = $tip[0].offsetHeight

      if (autoPlace) {
        var orgPlacement = placement
        var $container   = this.options.container ? $(this.options.container) : this.$element.parent()
        var containerDim = this.getPosition($container)

        placement = placement == 'bottom' && pos.bottom + actualHeight > containerDim.bottom ? 'top'    :
                    placement == 'top'    && pos.top    - actualHeight < containerDim.top    ? 'bottom' :
                    placement == 'right'  && pos.right  + actualWidth  > containerDim.width  ? 'left'   :
                    placement == 'left'   && pos.left   - actualWidth  < containerDim.left   ? 'right'  :
                    placement

        $tip
          .removeClass(orgPlacement)
          .addClass(placement)
      }

      var calculatedOffset = this.getCalculatedOffset(placement, pos, actualWidth, actualHeight)

      this.applyPlacement(calculatedOffset, placement)

      var complete = function () {
        var prevHoverState = that.hoverState
        that.$element.trigger('shown.bs.' + that.type)
        that.hoverState = null

        if (prevHoverState == 'out') that.leave(that)
      }

      $.support.transition && this.$tip.hasClass('fade') ?
        $tip
          .one('bsTransitionEnd', complete)
          .emulateTransitionEnd(Tooltip.TRANSITION_DURATION) :
        complete()
    }
  }

  Tooltip.prototype.applyPlacement = function (offset, placement) {
    var $tip   = this.tip()
    var width  = $tip[0].offsetWidth
    var height = $tip[0].offsetHeight

    // manually read margins because getBoundingClientRect includes difference
    var marginTop = parseInt($tip.css('margin-top'), 10)
    var marginLeft = parseInt($tip.css('margin-left'), 10)

    // we must check for NaN for ie 8/9
    if (isNaN(marginTop))  marginTop  = 0
    if (isNaN(marginLeft)) marginLeft = 0

    offset.top  = offset.top  + marginTop
    offset.left = offset.left + marginLeft

    // $.fn.offset doesn't round pixel values
    // so we use setOffset directly with our own function B-0
    $.offset.setOffset($tip[0], $.extend({
      using: function (props) {
        $tip.css({
          top: Math.round(props.top),
          left: Math.round(props.left)
        })
      }
    }, offset), 0)

    $tip.addClass('in')

    // check to see if placing tip in new offset caused the tip to resize itself
    var actualWidth  = $tip[0].offsetWidth
    var actualHeight = $tip[0].offsetHeight

    if (placement == 'top' && actualHeight != height) {
      offset.top = offset.top + height - actualHeight
    }

    var delta = this.getViewportAdjustedDelta(placement, offset, actualWidth, actualHeight)

    if (delta.left) offset.left += delta.left
    else offset.top += delta.top

    var isVertical          = /top|bottom/.test(placement)
    var arrowDelta          = isVertical ? delta.left * 2 - width + actualWidth : delta.top * 2 - height + actualHeight
    var arrowOffsetPosition = isVertical ? 'offsetWidth' : 'offsetHeight'

    $tip.offset(offset)
    this.replaceArrow(arrowDelta, $tip[0][arrowOffsetPosition], isVertical)
  }

  Tooltip.prototype.replaceArrow = function (delta, dimension, isHorizontal) {
    this.arrow()
      .css(isHorizontal ? 'left' : 'top', 50 * (1 - delta / dimension) + '%')
      .css(isHorizontal ? 'top' : 'left', '')
  }

  Tooltip.prototype.setContent = function () {
    var $tip  = this.tip()
    var title = this.getTitle()

    $tip.find('.tooltip-inner')[this.options.html ? 'html' : 'text'](title)
    $tip.removeClass('fade in top bottom left right')
  }

  Tooltip.prototype.hide = function (callback) {
    var that = this
    var $tip = this.tip()
    var e    = $.Event('hide.bs.' + this.type)

    function complete() {
      if (that.hoverState != 'in') $tip.detach()
      that.$element
        .removeAttr('aria-describedby')
        .trigger('hidden.bs.' + that.type)
      callback && callback()
    }

    this.$element.trigger(e)

    if (e.isDefaultPrevented()) return

    $tip.removeClass('in')

    $.support.transition && this.$tip.hasClass('fade') ?
      $tip
        .one('bsTransitionEnd', complete)
        .emulateTransitionEnd(Tooltip.TRANSITION_DURATION) :
      complete()

    this.hoverState = null

    return this
  }

  Tooltip.prototype.fixTitle = function () {
    var $e = this.$element
    if ($e.attr('title') || typeof ($e.attr('data-original-title')) != 'string') {
      $e.attr('data-original-title', $e.attr('title') || '').attr('title', '')
    }
  }

  Tooltip.prototype.hasContent = function () {
    return this.getTitle()
  }

  Tooltip.prototype.getPosition = function ($element) {
    $element   = $element || this.$element

    var el     = $element[0]
    var isBody = el.tagName == 'BODY'

    var elRect    = el.getBoundingClientRect()
    if (elRect.width == null) {
      // width and height are missing in IE8, so compute them manually; see https://github.com/twbs/bootstrap/issues/14093
      elRect = $.extend({}, elRect, { width: elRect.right - elRect.left, height: elRect.bottom - elRect.top })
    }
    var elOffset  = isBody ? { top: 0, left: 0 } : $element.offset()
    var scroll    = { scroll: isBody ? document.documentElement.scrollTop || document.body.scrollTop : $element.scrollTop() }
    var outerDims = isBody ? { width: $(window).width(), height: $(window).height() } : null

    return $.extend({}, elRect, scroll, outerDims, elOffset)
  }

  Tooltip.prototype.getCalculatedOffset = function (placement, pos, actualWidth, actualHeight) {
    return placement == 'bottom' ? { top: pos.top + pos.height,   left: pos.left + pos.width / 2 - actualWidth / 2 } :
           placement == 'top'    ? { top: pos.top - actualHeight, left: pos.left + pos.width / 2 - actualWidth / 2 } :
           placement == 'left'   ? { top: pos.top + pos.height / 2 - actualHeight / 2, left: pos.left - actualWidth } :
        /* placement == 'right' */ { top: pos.top + pos.height / 2 - actualHeight / 2, left: pos.left + pos.width }

  }

  Tooltip.prototype.getViewportAdjustedDelta = function (placement, pos, actualWidth, actualHeight) {
    var delta = { top: 0, left: 0 }
    if (!this.$viewport) return delta

    var viewportPadding = this.options.viewport && this.options.viewport.padding || 0
    var viewportDimensions = this.getPosition(this.$viewport)

    if (/right|left/.test(placement)) {
      var topEdgeOffset    = pos.top - viewportPadding - viewportDimensions.scroll
      var bottomEdgeOffset = pos.top + viewportPadding - viewportDimensions.scroll + actualHeight
      if (topEdgeOffset < viewportDimensions.top) { // top overflow
        delta.top = viewportDimensions.top - topEdgeOffset
      } else if (bottomEdgeOffset > viewportDimensions.top + viewportDimensions.height) { // bottom overflow
        delta.top = viewportDimensions.top + viewportDimensions.height - bottomEdgeOffset
      }
    } else {
      var leftEdgeOffset  = pos.left - viewportPadding
      var rightEdgeOffset = pos.left + viewportPadding + actualWidth
      if (leftEdgeOffset < viewportDimensions.left) { // left overflow
        delta.left = viewportDimensions.left - leftEdgeOffset
      } else if (rightEdgeOffset > viewportDimensions.width) { // right overflow
        delta.left = viewportDimensions.left + viewportDimensions.width - rightEdgeOffset
      }
    }

    return delta
  }

  Tooltip.prototype.getTitle = function () {
    var title
    var $e = this.$element
    var o  = this.options

    title = $e.attr('data-original-title')
      || (typeof o.title == 'function' ? o.title.call($e[0]) :  o.title)

    return title
  }

  Tooltip.prototype.getUID = function (prefix) {
    do prefix += ~~(Math.random() * 1000000)
    while (document.getElementById(prefix))
    return prefix
  }

  Tooltip.prototype.tip = function () {
    return (this.$tip = this.$tip || $(this.options.template))
  }

  Tooltip.prototype.arrow = function () {
    return (this.$arrow = this.$arrow || this.tip().find('.tooltip-arrow'))
  }

  Tooltip.prototype.enable = function () {
    this.enabled = true
  }

  Tooltip.prototype.disable = function () {
    this.enabled = false
  }

  Tooltip.prototype.toggleEnabled = function () {
    this.enabled = !this.enabled
  }

  Tooltip.prototype.toggle = function (e) {
    var self = this
    if (e) {
      self = $(e.currentTarget).data('bs.' + this.type)
      if (!self) {
        self = new this.constructor(e.currentTarget, this.getDelegateOptions())
        $(e.currentTarget).data('bs.' + this.type, self)
      }
    }

    self.tip().hasClass('in') ? self.leave(self) : self.enter(self)
  }

  Tooltip.prototype.destroy = function () {
    var that = this
    clearTimeout(this.timeout)
    this.hide(function () {
      that.$element.off('.' + that.type).removeData('bs.' + that.type)
    })
  }


  // TOOLTIP PLUGIN DEFINITION
  // =========================

  function Plugin(option) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.tooltip')
      var options = typeof option == 'object' && option

      if (!data && option == 'destroy') return
      if (!data) $this.data('bs.tooltip', (data = new Tooltip(this, options)))
      if (typeof option == 'string') data[option]()
    })
  }

  var old = $.fn.tooltip

  $.fn.tooltip             = Plugin
  $.fn.tooltip.Constructor = Tooltip


  // TOOLTIP NO CONFLICT
  // ===================

  $.fn.tooltip.noConflict = function () {
    $.fn.tooltip = old
    return this
  }

}(jQuery);

/* ========================================================================
 * Bootstrap: popover.js v3.3.2
 * http://getbootstrap.com/javascript/#popovers
 * ========================================================================
 * Copyright 2011-2015 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
// POPOVER PUBLIC CLASS DEFINITION
  // ===============================

  var Popover = function (element, options) {
    this.init('popover', element, options)
  }

  if (!$.fn.tooltip) throw new Error('Popover requires tooltip.js')

  Popover.VERSION  = '3.3.2'

  Popover.DEFAULTS = $.extend({}, $.fn.tooltip.Constructor.DEFAULTS, {
    placement: 'right',
    trigger: 'click',
    content: '',
    template: '<div class="popover" role="tooltip"><div class="arrow"></div><h3 class="popover-title"></h3><div class="popover-content"></div></div>'
  })


  // NOTE: POPOVER EXTENDS tooltip.js
  // ================================

  Popover.prototype = $.extend({}, $.fn.tooltip.Constructor.prototype)

  Popover.prototype.constructor = Popover

  Popover.prototype.getDefaults = function () {
    return Popover.DEFAULTS
  }

  Popover.prototype.setContent = function () {
    var $tip    = this.tip()
    var title   = this.getTitle()
    var content = this.getContent()

    $tip.find('.popover-title')[this.options.html ? 'html' : 'text'](title)
    $tip.find('.popover-content').children().detach().end()[ // we use append for html objects to maintain js events
      this.options.html ? (typeof content == 'string' ? 'html' : 'append') : 'text'
    ](content)

    $tip.removeClass('fade top bottom left right in')

    // IE8 doesn't accept hiding via the `:empty` pseudo selector, we have to do
    // this manually by checking the contents.
    if (!$tip.find('.popover-title').html()) $tip.find('.popover-title').hide()
  }

  Popover.prototype.hasContent = function () {
    return this.getTitle() || this.getContent()
  }

  Popover.prototype.getContent = function () {
    var $e = this.$element
    var o  = this.options

    return $e.attr('data-content')
      || (typeof o.content == 'function' ?
            o.content.call($e[0]) :
            o.content)
  }

  Popover.prototype.arrow = function () {
    return (this.$arrow = this.$arrow || this.tip().find('.arrow'))
  }

  Popover.prototype.tip = function () {
    if (!this.$tip) this.$tip = $(this.options.template)
    return this.$tip
  }


  // POPOVER PLUGIN DEFINITION
  // =========================

  function Plugin(option) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.popover')
      var options = typeof option == 'object' && option

      if (!data && option == 'destroy') return
      if (!data) $this.data('bs.popover', (data = new Popover(this, options)))
      if (typeof option == 'string') data[option]()
    })
  }

  var old = $.fn.popover

  $.fn.popover             = Plugin
  $.fn.popover.Constructor = Popover


  // POPOVER NO CONFLICT
  // ===================

  $.fn.popover.noConflict = function () {
    $.fn.popover = old
    return this
  }

}(jQuery);

/* ========================================================================
 * Bootstrap: scrollspy.js v3.3.2
 * http://getbootstrap.com/javascript/#scrollspy
 * ========================================================================
 * Copyright 2011-2015 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
// SCROLLSPY CLASS DEFINITION
  // ==========================

  function ScrollSpy(element, options) {
    var process  = $.proxy(this.process, this)

    this.$body          = $('body')
    this.$scrollElement = $(element).is('body') ? $(window) : $(element)
    this.options        = $.extend({}, ScrollSpy.DEFAULTS, options)
    this.selector       = (this.options.target || '') + ' .nav li > a'
    this.offsets        = []
    this.targets        = []
    this.activeTarget   = null
    this.scrollHeight   = 0

    this.$scrollElement.on('scroll.bs.scrollspy', process)
    this.refresh()
    this.process()
  }

  ScrollSpy.VERSION  = '3.3.2'

  ScrollSpy.DEFAULTS = {
    offset: 10
  }

  ScrollSpy.prototype.getScrollHeight = function () {
    return this.$scrollElement[0].scrollHeight || Math.max(this.$body[0].scrollHeight, document.documentElement.scrollHeight)
  }

  ScrollSpy.prototype.refresh = function () {
    var offsetMethod = 'offset'
    var offsetBase   = 0

    if (!$.isWindow(this.$scrollElement[0])) {
      offsetMethod = 'position'
      offsetBase   = this.$scrollElement.scrollTop()
    }

    this.offsets = []
    this.targets = []
    this.scrollHeight = this.getScrollHeight()

    var self     = this

    this.$body
      .find(this.selector)
      .map(function () {
        var $el   = $(this)
        var href  = $el.data('target') || $el.attr('href')
        var $href = /^#./.test(href) && $(href)

        return ($href
          && $href.length
          && $href.is(':visible')
          && [[$href[offsetMethod]().top + offsetBase, href]]) || null
      })
      .sort(function (a, b) { return a[0] - b[0] })
      .each(function () {
        self.offsets.push(this[0])
        self.targets.push(this[1])
      })
  }

  ScrollSpy.prototype.process = function () {
    var scrollTop    = this.$scrollElement.scrollTop() + this.options.offset
    var scrollHeight = this.getScrollHeight()
    var maxScroll    = this.options.offset + scrollHeight - this.$scrollElement.height()
    var offsets      = this.offsets
    var targets      = this.targets
    var activeTarget = this.activeTarget
    var i

    if (this.scrollHeight != scrollHeight) {
      this.refresh()
    }

    if (scrollTop >= maxScroll) {
      return activeTarget != (i = targets[targets.length - 1]) && this.activate(i)
    }

    if (activeTarget && scrollTop < offsets[0]) {
      this.activeTarget = null
      return this.clear()
    }

    for (i = offsets.length; i--;) {
      activeTarget != targets[i]
        && scrollTop >= offsets[i]
        && (!offsets[i + 1] || scrollTop <= offsets[i + 1])
        && this.activate(targets[i])
    }
  }

  ScrollSpy.prototype.activate = function (target) {
    this.activeTarget = target

    this.clear()

    var selector = this.selector +
        '[data-target="' + target + '"],' +
        this.selector + '[href="' + target + '"]'

    var active = $(selector)
      .parents('li')
      .addClass('active')

    if (active.parent('.dropdown-menu').length) {
      active = active
        .closest('li.dropdown')
        .addClass('active')
    }

    active.trigger('activate.bs.scrollspy')
  }

  ScrollSpy.prototype.clear = function () {
    $(this.selector)
      .parentsUntil(this.options.target, '.active')
      .removeClass('active')
  }


  // SCROLLSPY PLUGIN DEFINITION
  // ===========================

  function Plugin(option) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.scrollspy')
      var options = typeof option == 'object' && option

      if (!data) $this.data('bs.scrollspy', (data = new ScrollSpy(this, options)))
      if (typeof option == 'string') data[option]()
    })
  }

  var old = $.fn.scrollspy

  $.fn.scrollspy             = Plugin
  $.fn.scrollspy.Constructor = ScrollSpy


  // SCROLLSPY NO CONFLICT
  // =====================

  $.fn.scrollspy.noConflict = function () {
    $.fn.scrollspy = old
    return this
  }


  // SCROLLSPY DATA-API
  // ==================

  $(window).on('load.bs.scrollspy.data-api', function () {
    $('[data-spy="scroll"]').each(function () {
      var $spy = $(this)
      Plugin.call($spy, $spy.data())
    })
  })

}(jQuery);

/* ========================================================================
 * Bootstrap: tab.js v3.3.2
 * http://getbootstrap.com/javascript/#tabs
 * ========================================================================
 * Copyright 2011-2015 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
// TAB CLASS DEFINITION
  // ====================

  var Tab = function (element) {
    this.element = $(element)
  }

  Tab.VERSION = '3.3.2'

  Tab.TRANSITION_DURATION = 150

  Tab.prototype.show = function () {
    var $this    = this.element
    var $ul      = $this.closest('ul:not(.dropdown-menu)')
    var selector = $this.data('target')

    if (!selector) {
      selector = $this.attr('href')
      selector = selector && selector.replace(/.*(?=#[^\s]*$)/, '') // strip for ie7
    }

    if ($this.parent('li').hasClass('active')) return

    var $previous = $ul.find('.active:last a')
    var hideEvent = $.Event('hide.bs.tab', {
      relatedTarget: $this[0]
    })
    var showEvent = $.Event('show.bs.tab', {
      relatedTarget: $previous[0]
    })

    $previous.trigger(hideEvent)
    $this.trigger(showEvent)

    if (showEvent.isDefaultPrevented() || hideEvent.isDefaultPrevented()) return

    var $target = $(selector)

    this.activate($this.closest('li'), $ul)
    this.activate($target, $target.parent(), function () {
      $previous.trigger({
        type: 'hidden.bs.tab',
        relatedTarget: $this[0]
      })
      $this.trigger({
        type: 'shown.bs.tab',
        relatedTarget: $previous[0]
      })
    })
  }

  Tab.prototype.activate = function (element, container, callback) {
    var $active    = container.find('> .active')
    var transition = callback
      && $.support.transition
      && (($active.length && $active.hasClass('fade')) || !!container.find('> .fade').length)

    function next() {
      $active
        .removeClass('active')
        .find('> .dropdown-menu > .active')
          .removeClass('active')
        .end()
        .find('[data-toggle="tab"]')
          .attr('aria-expanded', false)

      element
        .addClass('active')
        .find('[data-toggle="tab"]')
          .attr('aria-expanded', true)

      if (transition) {
        element[0].offsetWidth // reflow for transition
        element.addClass('in')
      } else {
        element.removeClass('fade')
      }

      if (element.parent('.dropdown-menu')) {
        element
          .closest('li.dropdown')
            .addClass('active')
          .end()
          .find('[data-toggle="tab"]')
            .attr('aria-expanded', true)
      }

      callback && callback()
    }

    $active.length && transition ?
      $active
        .one('bsTransitionEnd', next)
        .emulateTransitionEnd(Tab.TRANSITION_DURATION) :
      next()

    $active.removeClass('in')
  }


  // TAB PLUGIN DEFINITION
  // =====================

  function Plugin(option) {
    return this.each(function () {
      var $this = $(this)
      var data  = $this.data('bs.tab')

      if (!data) $this.data('bs.tab', (data = new Tab(this)))
      if (typeof option == 'string') data[option]()
    })
  }

  var old = $.fn.tab

  $.fn.tab             = Plugin
  $.fn.tab.Constructor = Tab


  // TAB NO CONFLICT
  // ===============

  $.fn.tab.noConflict = function () {
    $.fn.tab = old
    return this
  }


  // TAB DATA-API
  // ============

  var clickHandler = function (e) {
    e.preventDefault()
    Plugin.call($(this), 'show')
  }

  $(document)
    .on('click.bs.tab.data-api', '[data-toggle="tab"]', clickHandler)
    .on('click.bs.tab.data-api', '[data-toggle="pill"]', clickHandler)

}(jQuery);

/* ========================================================================
 * Bootstrap: affix.js v3.3.2
 * http://getbootstrap.com/javascript/#affix
 * ========================================================================
 * Copyright 2011-2015 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
// AFFIX CLASS DEFINITION
  // ======================

  var Affix = function (element, options) {
    this.options = $.extend({}, Affix.DEFAULTS, options)

    this.$target = $(this.options.target)
      .on('scroll.bs.affix.data-api', $.proxy(this.checkPosition, this))
      .on('click.bs.affix.data-api',  $.proxy(this.checkPositionWithEventLoop, this))

    this.$element     = $(element)
    this.affixed      =
    this.unpin        =
    this.pinnedOffset = null

    this.checkPosition()
  }

  Affix.VERSION  = '3.3.2'

  Affix.RESET    = 'affix affix-top affix-bottom'

  Affix.DEFAULTS = {
    offset: 0,
    target: window
  }

  Affix.prototype.getState = function (scrollHeight, height, offsetTop, offsetBottom) {
    var scrollTop    = this.$target.scrollTop()
    var position     = this.$element.offset()
    var targetHeight = this.$target.height()

    if (offsetTop != null && this.affixed == 'top') return scrollTop < offsetTop ? 'top' : false

    if (this.affixed == 'bottom') {
      if (offsetTop != null) return (scrollTop + this.unpin <= position.top) ? false : 'bottom'
      return (scrollTop + targetHeight <= scrollHeight - offsetBottom) ? false : 'bottom'
    }

    var initializing   = this.affixed == null
    var colliderTop    = initializing ? scrollTop : position.top
    var colliderHeight = initializing ? targetHeight : height

    if (offsetTop != null && scrollTop <= offsetTop) return 'top'
    if (offsetBottom != null && (colliderTop + colliderHeight >= scrollHeight - offsetBottom)) return 'bottom'

    return false
  }

  Affix.prototype.getPinnedOffset = function () {
    if (this.pinnedOffset) return this.pinnedOffset
    this.$element.removeClass(Affix.RESET).addClass('affix')
    var scrollTop = this.$target.scrollTop()
    var position  = this.$element.offset()
    return (this.pinnedOffset = position.top - scrollTop)
  }

  Affix.prototype.checkPositionWithEventLoop = function () {
    setTimeout($.proxy(this.checkPosition, this), 1)
  }

  Affix.prototype.checkPosition = function () {
    if (!this.$element.is(':visible')) return

    var height       = this.$element.height()
    var offset       = this.options.offset
    var offsetTop    = offset.top
    var offsetBottom = offset.bottom
    var scrollHeight = $('body').height()

    if (typeof offset != 'object')         offsetBottom = offsetTop = offset
    if (typeof offsetTop == 'function')    offsetTop    = offset.top(this.$element)
    if (typeof offsetBottom == 'function') offsetBottom = offset.bottom(this.$element)

    var affix = this.getState(scrollHeight, height, offsetTop, offsetBottom)

    if (this.affixed != affix) {
      if (this.unpin != null) this.$element.css('top', '')

      var affixType = 'affix' + (affix ? '-' + affix : '')
      var e         = $.Event(affixType + '.bs.affix')

      this.$element.trigger(e)

      if (e.isDefaultPrevented()) return

      this.affixed = affix
      this.unpin = affix == 'bottom' ? this.getPinnedOffset() : null

      this.$element
        .removeClass(Affix.RESET)
        .addClass(affixType)
        .trigger(affixType.replace('affix', 'affixed') + '.bs.affix')
    }

    if (affix == 'bottom') {
      this.$element.offset({
        top: scrollHeight - height - offsetBottom
      })
    }
  }


  // AFFIX PLUGIN DEFINITION
  // =======================

  function Plugin(option) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.affix')
      var options = typeof option == 'object' && option

      if (!data) $this.data('bs.affix', (data = new Affix(this, options)))
      if (typeof option == 'string') data[option]()
    })
  }

  var old = $.fn.affix

  $.fn.affix             = Plugin
  $.fn.affix.Constructor = Affix


  // AFFIX NO CONFLICT
  // =================

  $.fn.affix.noConflict = function () {
    $.fn.affix = old
    return this
  }


  // AFFIX DATA-API
  // ==============

  $(window).on('load', function () {
    $('[data-spy="affix"]').each(function () {
      var $spy = $(this)
      var data = $spy.data()

      data.offset = data.offset || {}

      if (data.offsetBottom != null) data.offset.bottom = data.offsetBottom
      if (data.offsetTop    != null) data.offset.top    = data.offsetTop

      Plugin.call($spy, data)
    })
  })

}(jQuery);

// Source: public/javascripts/vendor/markdown/he.js
/*! https://mths.be/he v0.5.0 by @mathias | MIT license */
;
(function (root) {

    // Detect free variables `exports`.
    var freeExports = typeof exports == 'object' && exports;

    // Detect free variable `module`.
    var freeModule = typeof module == 'object' && module &&
        module.exports == freeExports && module;

    // Detect free variable `global`, from Node.js or Browserified code,
    // and use it as `root`.
    var freeGlobal = typeof global == 'object' && global;
    if (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal) {
        root = freeGlobal;
    }

    /*--------------------------------------------------------------------------*/

    // All astral symbols.
    var regexAstralSymbols = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;
    // All ASCII symbols (not just printable ASCII) except those listed in the
    // first column of the overrides table.
    // https://html.spec.whatwg.org/multipage/syntax.html#table-charref-overrides
    var regexAsciiWhitelist = /[\x01-\x7F]/g;
    // All BMP symbols that are not ASCII newlines, printable ASCII symbols, or
    // code points listed in the first column of the overrides table on
    // https://html.spec.whatwg.org/multipage/syntax.html#table-charref-overrides.
    var regexBmpWhitelist = /[\x01-\t\x0B\f\x0E-\x1F\x7F\x81\x8D\x8F\x90\x9D\xA0-\uFFFF]/g;

    var regexEncodeNonAscii = /<\u20D2|=\u20E5|>\u20D2|\u205F\u200A|\u219D\u0338|\u2202\u0338|\u2220\u20D2|\u2229\uFE00|\u222A\uFE00|\u223C\u20D2|\u223D\u0331|\u223E\u0333|\u2242\u0338|\u224B\u0338|\u224D\u20D2|\u224E\u0338|\u224F\u0338|\u2250\u0338|\u2261\u20E5|\u2264\u20D2|\u2265\u20D2|\u2266\u0338|\u2267\u0338|\u2268\uFE00|\u2269\uFE00|\u226A\u0338|\u226A\u20D2|\u226B\u0338|\u226B\u20D2|\u227F\u0338|\u2282\u20D2|\u2283\u20D2|\u228A\uFE00|\u228B\uFE00|\u228F\u0338|\u2290\u0338|\u2293\uFE00|\u2294\uFE00|\u22B4\u20D2|\u22B5\u20D2|\u22D8\u0338|\u22D9\u0338|\u22DA\uFE00|\u22DB\uFE00|\u22F5\u0338|\u22F9\u0338|\u2933\u0338|\u29CF\u0338|\u29D0\u0338|\u2A6D\u0338|\u2A70\u0338|\u2A7D\u0338|\u2A7E\u0338|\u2AA1\u0338|\u2AA2\u0338|\u2AAC\uFE00|\u2AAD\uFE00|\u2AAF\u0338|\u2AB0\u0338|\u2AC5\u0338|\u2AC6\u0338|\u2ACB\uFE00|\u2ACC\uFE00|\u2AFD\u20E5|[\xA0-\u0113\u0116-\u0122\u0124-\u012B\u012E-\u014D\u0150-\u017E\u0192\u01B5\u01F5\u0237\u02C6\u02C7\u02D8-\u02DD\u0311\u0391-\u03A1\u03A3-\u03A9\u03B1-\u03C9\u03D1\u03D2\u03D5\u03D6\u03DC\u03DD\u03F0\u03F1\u03F5\u03F6\u0401-\u040C\u040E-\u044F\u0451-\u045C\u045E\u045F\u2002-\u2005\u2007-\u2010\u2013-\u2016\u2018-\u201A\u201C-\u201E\u2020-\u2022\u2025\u2026\u2030-\u2035\u2039\u203A\u203E\u2041\u2043\u2044\u204F\u2057\u205F-\u2063\u20AC\u20DB\u20DC\u2102\u2105\u210A-\u2113\u2115-\u211E\u2122\u2124\u2127-\u2129\u212C\u212D\u212F-\u2131\u2133-\u2138\u2145-\u2148\u2153-\u215E\u2190-\u219B\u219D-\u21A7\u21A9-\u21AE\u21B0-\u21B3\u21B5-\u21B7\u21BA-\u21DB\u21DD\u21E4\u21E5\u21F5\u21FD-\u2205\u2207-\u2209\u220B\u220C\u220F-\u2214\u2216-\u2218\u221A\u221D-\u2238\u223A-\u2257\u2259\u225A\u225C\u225F-\u2262\u2264-\u228B\u228D-\u229B\u229D-\u22A5\u22A7-\u22B0\u22B2-\u22BB\u22BD-\u22DB\u22DE-\u22E3\u22E6-\u22F7\u22F9-\u22FE\u2305\u2306\u2308-\u2310\u2312\u2313\u2315\u2316\u231C-\u231F\u2322\u2323\u232D\u232E\u2336\u233D\u233F\u237C\u23B0\u23B1\u23B4-\u23B6\u23DC-\u23DF\u23E2\u23E7\u2423\u24C8\u2500\u2502\u250C\u2510\u2514\u2518\u251C\u2524\u252C\u2534\u253C\u2550-\u256C\u2580\u2584\u2588\u2591-\u2593\u25A1\u25AA\u25AB\u25AD\u25AE\u25B1\u25B3-\u25B5\u25B8\u25B9\u25BD-\u25BF\u25C2\u25C3\u25CA\u25CB\u25EC\u25EF\u25F8-\u25FC\u2605\u2606\u260E\u2640\u2642\u2660\u2663\u2665\u2666\u266A\u266D-\u266F\u2713\u2717\u2720\u2736\u2758\u2772\u2773\u27C8\u27C9\u27E6-\u27ED\u27F5-\u27FA\u27FC\u27FF\u2902-\u2905\u290C-\u2913\u2916\u2919-\u2920\u2923-\u292A\u2933\u2935-\u2939\u293C\u293D\u2945\u2948-\u294B\u294E-\u2976\u2978\u2979\u297B-\u297F\u2985\u2986\u298B-\u2996\u299A\u299C\u299D\u29A4-\u29B7\u29B9\u29BB\u29BC\u29BE-\u29C5\u29C9\u29CD-\u29D0\u29DC-\u29DE\u29E3-\u29E5\u29EB\u29F4\u29F6\u2A00-\u2A02\u2A04\u2A06\u2A0C\u2A0D\u2A10-\u2A17\u2A22-\u2A27\u2A29\u2A2A\u2A2D-\u2A31\u2A33-\u2A3C\u2A3F\u2A40\u2A42-\u2A4D\u2A50\u2A53-\u2A58\u2A5A-\u2A5D\u2A5F\u2A66\u2A6A\u2A6D-\u2A75\u2A77-\u2A9A\u2A9D-\u2AA2\u2AA4-\u2AB0\u2AB3-\u2AC8\u2ACB\u2ACC\u2ACF-\u2ADB\u2AE4\u2AE6-\u2AE9\u2AEB-\u2AF3\u2AFD\uFB00-\uFB04]|\uD835[\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDCCF\uDD04\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD1E-\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD52-\uDD6B]/g;
    var encodeMap = {
        '\xC1': 'Aacute',
        '\xE1': 'aacute',
        '\u0102': 'Abreve',
        '\u0103': 'abreve',
        '\u223E': 'ac',
        '\u223F': 'acd',
        '\u223E\u0333': 'acE',
        '\xC2': 'Acirc',
        '\xE2': 'acirc',
        '\xB4': 'acute',
        '\u0410': 'Acy',
        '\u0430': 'acy',
        '\xC6': 'AElig',
        '\xE6': 'aelig',
        '\u2061': 'af',
        '\uD835\uDD04': 'Afr',
        '\uD835\uDD1E': 'afr',
        '\xC0': 'Agrave',
        '\xE0': 'agrave',
        '\u2135': 'aleph',
        '\u0391': 'Alpha',
        '\u03B1': 'alpha',
        '\u0100': 'Amacr',
        '\u0101': 'amacr',
        '\u2A3F': 'amalg',
        '&': 'amp',
        '\u2A55': 'andand',
        '\u2A53': 'And',
        '\u2227': 'and',
        '\u2A5C': 'andd',
        '\u2A58': 'andslope',
        '\u2A5A': 'andv',
        '\u2220': 'ang',
        '\u29A4': 'ange',
        '\u29A8': 'angmsdaa',
        '\u29A9': 'angmsdab',
        '\u29AA': 'angmsdac',
        '\u29AB': 'angmsdad',
        '\u29AC': 'angmsdae',
        '\u29AD': 'angmsdaf',
        '\u29AE': 'angmsdag',
        '\u29AF': 'angmsdah',
        '\u2221': 'angmsd',
        '\u221F': 'angrt',
        '\u22BE': 'angrtvb',
        '\u299D': 'angrtvbd',
        '\u2222': 'angsph',
        '\xC5': 'angst',
        '\u237C': 'angzarr',
        '\u0104': 'Aogon',
        '\u0105': 'aogon',
        '\uD835\uDD38': 'Aopf',
        '\uD835\uDD52': 'aopf',
        '\u2A6F': 'apacir',
        '\u2248': 'ap',
        '\u2A70': 'apE',
        '\u224A': 'ape',
        '\u224B': 'apid',
        '\'': 'apos',
        '\xE5': 'aring',
        '\uD835\uDC9C': 'Ascr',
        '\uD835\uDCB6': 'ascr',
        '\u2254': 'colone',
        '*': 'ast',
        '\u224D': 'CupCap',
        '\xC3': 'Atilde',
        '\xE3': 'atilde',
        '\xC4': 'Auml',
        '\xE4': 'auml',
        '\u2233': 'awconint',
        '\u2A11': 'awint',
        '\u224C': 'bcong',
        '\u03F6': 'bepsi',
        '\u2035': 'bprime',
        '\u223D': 'bsim',
        '\u22CD': 'bsime',
        '\u2216': 'setmn',
        '\u2AE7': 'Barv',
        '\u22BD': 'barvee',
        '\u2305': 'barwed',
        '\u2306': 'Barwed',
        '\u23B5': 'bbrk',
        '\u23B6': 'bbrktbrk',
        '\u0411': 'Bcy',
        '\u0431': 'bcy',
        '\u201E': 'bdquo',
        '\u2235': 'becaus',
        '\u29B0': 'bemptyv',
        '\u212C': 'Bscr',
        '\u0392': 'Beta',
        '\u03B2': 'beta',
        '\u2136': 'beth',
        '\u226C': 'twixt',
        '\uD835\uDD05': 'Bfr',
        '\uD835\uDD1F': 'bfr',
        '\u22C2': 'xcap',
        '\u25EF': 'xcirc',
        '\u22C3': 'xcup',
        '\u2A00': 'xodot',
        '\u2A01': 'xoplus',
        '\u2A02': 'xotime',
        '\u2A06': 'xsqcup',
        '\u2605': 'starf',
        '\u25BD': 'xdtri',
        '\u25B3': 'xutri',
        '\u2A04': 'xuplus',
        '\u22C1': 'Vee',
        '\u22C0': 'Wedge',
        '\u290D': 'rbarr',
        '\u29EB': 'lozf',
        '\u25AA': 'squf',
        '\u25B4': 'utrif',
        '\u25BE': 'dtrif',
        '\u25C2': 'ltrif',
        '\u25B8': 'rtrif',
        '\u2423': 'blank',
        '\u2592': 'blk12',
        '\u2591': 'blk14',
        '\u2593': 'blk34',
        '\u2588': 'block',
        '=\u20E5': 'bne',
        '\u2261\u20E5': 'bnequiv',
        '\u2AED': 'bNot',
        '\u2310': 'bnot',
        '\uD835\uDD39': 'Bopf',
        '\uD835\uDD53': 'bopf',
        '\u22A5': 'bot',
        '\u22C8': 'bowtie',
        '\u29C9': 'boxbox',
        '\u2510': 'boxdl',
        '\u2555': 'boxdL',
        '\u2556': 'boxDl',
        '\u2557': 'boxDL',
        '\u250C': 'boxdr',
        '\u2552': 'boxdR',
        '\u2553': 'boxDr',
        '\u2554': 'boxDR',
        '\u2500': 'boxh',
        '\u2550': 'boxH',
        '\u252C': 'boxhd',
        '\u2564': 'boxHd',
        '\u2565': 'boxhD',
        '\u2566': 'boxHD',
        '\u2534': 'boxhu',
        '\u2567': 'boxHu',
        '\u2568': 'boxhU',
        '\u2569': 'boxHU',
        '\u229F': 'minusb',
        '\u229E': 'plusb',
        '\u22A0': 'timesb',
        '\u2518': 'boxul',
        '\u255B': 'boxuL',
        '\u255C': 'boxUl',
        '\u255D': 'boxUL',
        '\u2514': 'boxur',
        '\u2558': 'boxuR',
        '\u2559': 'boxUr',
        '\u255A': 'boxUR',
        '\u2502': 'boxv',
        '\u2551': 'boxV',
        '\u253C': 'boxvh',
        '\u256A': 'boxvH',
        '\u256B': 'boxVh',
        '\u256C': 'boxVH',
        '\u2524': 'boxvl',
        '\u2561': 'boxvL',
        '\u2562': 'boxVl',
        '\u2563': 'boxVL',
        '\u251C': 'boxvr',
        '\u255E': 'boxvR',
        '\u255F': 'boxVr',
        '\u2560': 'boxVR',
        '\u02D8': 'breve',
        '\xA6': 'brvbar',
        '\uD835\uDCB7': 'bscr',
        '\u204F': 'bsemi',
        '\u29C5': 'bsolb',
        '\\': 'bsol',
        '\u27C8': 'bsolhsub',
        '\u2022': 'bull',
        '\u224E': 'bump',
        '\u2AAE': 'bumpE',
        '\u224F': 'bumpe',
        '\u0106': 'Cacute',
        '\u0107': 'cacute',
        '\u2A44': 'capand',
        '\u2A49': 'capbrcup',
        '\u2A4B': 'capcap',
        '\u2229': 'cap',
        '\u22D2': 'Cap',
        '\u2A47': 'capcup',
        '\u2A40': 'capdot',
        '\u2145': 'DD',
        '\u2229\uFE00': 'caps',
        '\u2041': 'caret',
        '\u02C7': 'caron',
        '\u212D': 'Cfr',
        '\u2A4D': 'ccaps',
        '\u010C': 'Ccaron',
        '\u010D': 'ccaron',
        '\xC7': 'Ccedil',
        '\xE7': 'ccedil',
        '\u0108': 'Ccirc',
        '\u0109': 'ccirc',
        '\u2230': 'Cconint',
        '\u2A4C': 'ccups',
        '\u2A50': 'ccupssm',
        '\u010A': 'Cdot',
        '\u010B': 'cdot',
        '\xB8': 'cedil',
        '\u29B2': 'cemptyv',
        '\xA2': 'cent',
        '\xB7': 'middot',
        '\uD835\uDD20': 'cfr',
        '\u0427': 'CHcy',
        '\u0447': 'chcy',
        '\u2713': 'check',
        '\u03A7': 'Chi',
        '\u03C7': 'chi',
        '\u02C6': 'circ',
        '\u2257': 'cire',
        '\u21BA': 'olarr',
        '\u21BB': 'orarr',
        '\u229B': 'oast',
        '\u229A': 'ocir',
        '\u229D': 'odash',
        '\u2299': 'odot',
        '\xAE': 'reg',
        '\u24C8': 'oS',
        '\u2296': 'ominus',
        '\u2295': 'oplus',
        '\u2297': 'otimes',
        '\u25CB': 'cir',
        '\u29C3': 'cirE',
        '\u2A10': 'cirfnint',
        '\u2AEF': 'cirmid',
        '\u29C2': 'cirscir',
        '\u2232': 'cwconint',
        '\u201D': 'rdquo',
        '\u2019': 'rsquo',
        '\u2663': 'clubs',
        ':': 'colon',
        '\u2237': 'Colon',
        '\u2A74': 'Colone',
        ',': 'comma',
        '@': 'commat',
        '\u2201': 'comp',
        '\u2218': 'compfn',
        '\u2102': 'Copf',
        '\u2245': 'cong',
        '\u2A6D': 'congdot',
        '\u2261': 'equiv',
        '\u222E': 'oint',
        '\u222F': 'Conint',
        '\uD835\uDD54': 'copf',
        '\u2210': 'coprod',
        '\xA9': 'copy',
        '\u2117': 'copysr',
        '\u21B5': 'crarr',
        '\u2717': 'cross',
        '\u2A2F': 'Cross',
        '\uD835\uDC9E': 'Cscr',
        '\uD835\uDCB8': 'cscr',
        '\u2ACF': 'csub',
        '\u2AD1': 'csube',
        '\u2AD0': 'csup',
        '\u2AD2': 'csupe',
        '\u22EF': 'ctdot',
        '\u2938': 'cudarrl',
        '\u2935': 'cudarrr',
        '\u22DE': 'cuepr',
        '\u22DF': 'cuesc',
        '\u21B6': 'cularr',
        '\u293D': 'cularrp',
        '\u2A48': 'cupbrcap',
        '\u2A46': 'cupcap',
        '\u222A': 'cup',
        '\u22D3': 'Cup',
        '\u2A4A': 'cupcup',
        '\u228D': 'cupdot',
        '\u2A45': 'cupor',
        '\u222A\uFE00': 'cups',
        '\u21B7': 'curarr',
        '\u293C': 'curarrm',
        '\u22CE': 'cuvee',
        '\u22CF': 'cuwed',
        '\xA4': 'curren',
        '\u2231': 'cwint',
        '\u232D': 'cylcty',
        '\u2020': 'dagger',
        '\u2021': 'Dagger',
        '\u2138': 'daleth',
        '\u2193': 'darr',
        '\u21A1': 'Darr',
        '\u21D3': 'dArr',
        '\u2010': 'dash',
        '\u2AE4': 'Dashv',
        '\u22A3': 'dashv',
        '\u290F': 'rBarr',
        '\u02DD': 'dblac',
        '\u010E': 'Dcaron',
        '\u010F': 'dcaron',
        '\u0414': 'Dcy',
        '\u0434': 'dcy',
        '\u21CA': 'ddarr',
        '\u2146': 'dd',
        '\u2911': 'DDotrahd',
        '\u2A77': 'eDDot',
        '\xB0': 'deg',
        '\u2207': 'Del',
        '\u0394': 'Delta',
        '\u03B4': 'delta',
        '\u29B1': 'demptyv',
        '\u297F': 'dfisht',
        '\uD835\uDD07': 'Dfr',
        '\uD835\uDD21': 'dfr',
        '\u2965': 'dHar',
        '\u21C3': 'dharl',
        '\u21C2': 'dharr',
        '\u02D9': 'dot',
        '`': 'grave',
        '\u02DC': 'tilde',
        '\u22C4': 'diam',
        '\u2666': 'diams',
        '\xA8': 'die',
        '\u03DD': 'gammad',
        '\u22F2': 'disin',
        '\xF7': 'div',
        '\u22C7': 'divonx',
        '\u0402': 'DJcy',
        '\u0452': 'djcy',
        '\u231E': 'dlcorn',
        '\u230D': 'dlcrop',
        '$': 'dollar',
        '\uD835\uDD3B': 'Dopf',
        '\uD835\uDD55': 'dopf',
        '\u20DC': 'DotDot',
        '\u2250': 'doteq',
        '\u2251': 'eDot',
        '\u2238': 'minusd',
        '\u2214': 'plusdo',
        '\u22A1': 'sdotb',
        '\u21D0': 'lArr',
        '\u21D4': 'iff',
        '\u27F8': 'xlArr',
        '\u27FA': 'xhArr',
        '\u27F9': 'xrArr',
        '\u21D2': 'rArr',
        '\u22A8': 'vDash',
        '\u21D1': 'uArr',
        '\u21D5': 'vArr',
        '\u2225': 'par',
        '\u2913': 'DownArrowBar',
        '\u21F5': 'duarr',
        '\u0311': 'DownBreve',
        '\u2950': 'DownLeftRightVector',
        '\u295E': 'DownLeftTeeVector',
        '\u2956': 'DownLeftVectorBar',
        '\u21BD': 'lhard',
        '\u295F': 'DownRightTeeVector',
        '\u2957': 'DownRightVectorBar',
        '\u21C1': 'rhard',
        '\u21A7': 'mapstodown',
        '\u22A4': 'top',
        '\u2910': 'RBarr',
        '\u231F': 'drcorn',
        '\u230C': 'drcrop',
        '\uD835\uDC9F': 'Dscr',
        '\uD835\uDCB9': 'dscr',
        '\u0405': 'DScy',
        '\u0455': 'dscy',
        '\u29F6': 'dsol',
        '\u0110': 'Dstrok',
        '\u0111': 'dstrok',
        '\u22F1': 'dtdot',
        '\u25BF': 'dtri',
        '\u296F': 'duhar',
        '\u29A6': 'dwangle',
        '\u040F': 'DZcy',
        '\u045F': 'dzcy',
        '\u27FF': 'dzigrarr',
        '\xC9': 'Eacute',
        '\xE9': 'eacute',
        '\u2A6E': 'easter',
        '\u011A': 'Ecaron',
        '\u011B': 'ecaron',
        '\xCA': 'Ecirc',
        '\xEA': 'ecirc',
        '\u2256': 'ecir',
        '\u2255': 'ecolon',
        '\u042D': 'Ecy',
        '\u044D': 'ecy',
        '\u0116': 'Edot',
        '\u0117': 'edot',
        '\u2147': 'ee',
        '\u2252': 'efDot',
        '\uD835\uDD08': 'Efr',
        '\uD835\uDD22': 'efr',
        '\u2A9A': 'eg',
        '\xC8': 'Egrave',
        '\xE8': 'egrave',
        '\u2A96': 'egs',
        '\u2A98': 'egsdot',
        '\u2A99': 'el',
        '\u2208': 'in',
        '\u23E7': 'elinters',
        '\u2113': 'ell',
        '\u2A95': 'els',
        '\u2A97': 'elsdot',
        '\u0112': 'Emacr',
        '\u0113': 'emacr',
        '\u2205': 'empty',
        '\u25FB': 'EmptySmallSquare',
        '\u25AB': 'EmptyVerySmallSquare',
        '\u2004': 'emsp13',
        '\u2005': 'emsp14',
        '\u2003': 'emsp',
        '\u014A': 'ENG',
        '\u014B': 'eng',
        '\u2002': 'ensp',
        '\u0118': 'Eogon',
        '\u0119': 'eogon',
        '\uD835\uDD3C': 'Eopf',
        '\uD835\uDD56': 'eopf',
        '\u22D5': 'epar',
        '\u29E3': 'eparsl',
        '\u2A71': 'eplus',
        '\u03B5': 'epsi',
        '\u0395': 'Epsilon',
        '\u03F5': 'epsiv',
        '\u2242': 'esim',
        '\u2A75': 'Equal',
        '=': 'equals',
        '\u225F': 'equest',
        '\u21CC': 'rlhar',
        '\u2A78': 'equivDD',
        '\u29E5': 'eqvparsl',
        '\u2971': 'erarr',
        '\u2253': 'erDot',
        '\u212F': 'escr',
        '\u2130': 'Escr',
        '\u2A73': 'Esim',
        '\u0397': 'Eta',
        '\u03B7': 'eta',
        '\xD0': 'ETH',
        '\xF0': 'eth',
        '\xCB': 'Euml',
        '\xEB': 'euml',
        '\u20AC': 'euro',
        '!': 'excl',
        '\u2203': 'exist',
        '\u0424': 'Fcy',
        '\u0444': 'fcy',
        '\u2640': 'female',
        '\uFB03': 'ffilig',
        '\uFB00': 'fflig',
        '\uFB04': 'ffllig',
        '\uD835\uDD09': 'Ffr',
        '\uD835\uDD23': 'ffr',
        '\uFB01': 'filig',
        '\u25FC': 'FilledSmallSquare',
        'fj': 'fjlig',
        '\u266D': 'flat',
        '\uFB02': 'fllig',
        '\u25B1': 'fltns',
        '\u0192': 'fnof',
        '\uD835\uDD3D': 'Fopf',
        '\uD835\uDD57': 'fopf',
        '\u2200': 'forall',
        '\u22D4': 'fork',
        '\u2AD9': 'forkv',
        '\u2131': 'Fscr',
        '\u2A0D': 'fpartint',
        '\xBD': 'half',
        '\u2153': 'frac13',
        '\xBC': 'frac14',
        '\u2155': 'frac15',
        '\u2159': 'frac16',
        '\u215B': 'frac18',
        '\u2154': 'frac23',
        '\u2156': 'frac25',
        '\xBE': 'frac34',
        '\u2157': 'frac35',
        '\u215C': 'frac38',
        '\u2158': 'frac45',
        '\u215A': 'frac56',
        '\u215D': 'frac58',
        '\u215E': 'frac78',
        '\u2044': 'frasl',
        '\u2322': 'frown',
        '\uD835\uDCBB': 'fscr',
        '\u01F5': 'gacute',
        '\u0393': 'Gamma',
        '\u03B3': 'gamma',
        '\u03DC': 'Gammad',
        '\u2A86': 'gap',
        '\u011E': 'Gbreve',
        '\u011F': 'gbreve',
        '\u0122': 'Gcedil',
        '\u011C': 'Gcirc',
        '\u011D': 'gcirc',
        '\u0413': 'Gcy',
        '\u0433': 'gcy',
        '\u0120': 'Gdot',
        '\u0121': 'gdot',
        '\u2265': 'ge',
        '\u2267': 'gE',
        '\u2A8C': 'gEl',
        '\u22DB': 'gel',
        '\u2A7E': 'ges',
        '\u2AA9': 'gescc',
        '\u2A80': 'gesdot',
        '\u2A82': 'gesdoto',
        '\u2A84': 'gesdotol',
        '\u22DB\uFE00': 'gesl',
        '\u2A94': 'gesles',
        '\uD835\uDD0A': 'Gfr',
        '\uD835\uDD24': 'gfr',
        '\u226B': 'gg',
        '\u22D9': 'Gg',
        '\u2137': 'gimel',
        '\u0403': 'GJcy',
        '\u0453': 'gjcy',
        '\u2AA5': 'gla',
        '\u2277': 'gl',
        '\u2A92': 'glE',
        '\u2AA4': 'glj',
        '\u2A8A': 'gnap',
        '\u2A88': 'gne',
        '\u2269': 'gnE',
        '\u22E7': 'gnsim',
        '\uD835\uDD3E': 'Gopf',
        '\uD835\uDD58': 'gopf',
        '\u2AA2': 'GreaterGreater',
        '\u2273': 'gsim',
        '\uD835\uDCA2': 'Gscr',
        '\u210A': 'gscr',
        '\u2A8E': 'gsime',
        '\u2A90': 'gsiml',
        '\u2AA7': 'gtcc',
        '\u2A7A': 'gtcir',
        '>': 'gt',
        '\u22D7': 'gtdot',
        '\u2995': 'gtlPar',
        '\u2A7C': 'gtquest',
        '\u2978': 'gtrarr',
        '\u2269\uFE00': 'gvnE',
        '\u200A': 'hairsp',
        '\u210B': 'Hscr',
        '\u042A': 'HARDcy',
        '\u044A': 'hardcy',
        '\u2948': 'harrcir',
        '\u2194': 'harr',
        '\u21AD': 'harrw',
        '^': 'Hat',
        '\u210F': 'hbar',
        '\u0124': 'Hcirc',
        '\u0125': 'hcirc',
        '\u2665': 'hearts',
        '\u2026': 'mldr',
        '\u22B9': 'hercon',
        '\uD835\uDD25': 'hfr',
        '\u210C': 'Hfr',
        '\u2925': 'searhk',
        '\u2926': 'swarhk',
        '\u21FF': 'hoarr',
        '\u223B': 'homtht',
        '\u21A9': 'larrhk',
        '\u21AA': 'rarrhk',
        '\uD835\uDD59': 'hopf',
        '\u210D': 'Hopf',
        '\u2015': 'horbar',
        '\uD835\uDCBD': 'hscr',
        '\u0126': 'Hstrok',
        '\u0127': 'hstrok',
        '\u2043': 'hybull',
        '\xCD': 'Iacute',
        '\xED': 'iacute',
        '\u2063': 'ic',
        '\xCE': 'Icirc',
        '\xEE': 'icirc',
        '\u0418': 'Icy',
        '\u0438': 'icy',
        '\u0130': 'Idot',
        '\u0415': 'IEcy',
        '\u0435': 'iecy',
        '\xA1': 'iexcl',
        '\uD835\uDD26': 'ifr',
        '\u2111': 'Im',
        '\xCC': 'Igrave',
        '\xEC': 'igrave',
        '\u2148': 'ii',
        '\u2A0C': 'qint',
        '\u222D': 'tint',
        '\u29DC': 'iinfin',
        '\u2129': 'iiota',
        '\u0132': 'IJlig',
        '\u0133': 'ijlig',
        '\u012A': 'Imacr',
        '\u012B': 'imacr',
        '\u2110': 'Iscr',
        '\u0131': 'imath',
        '\u22B7': 'imof',
        '\u01B5': 'imped',
        '\u2105': 'incare',
        '\u221E': 'infin',
        '\u29DD': 'infintie',
        '\u22BA': 'intcal',
        '\u222B': 'int',
        '\u222C': 'Int',
        '\u2124': 'Zopf',
        '\u2A17': 'intlarhk',
        '\u2A3C': 'iprod',
        '\u2062': 'it',
        '\u0401': 'IOcy',
        '\u0451': 'iocy',
        '\u012E': 'Iogon',
        '\u012F': 'iogon',
        '\uD835\uDD40': 'Iopf',
        '\uD835\uDD5A': 'iopf',
        '\u0399': 'Iota',
        '\u03B9': 'iota',
        '\xBF': 'iquest',
        '\uD835\uDCBE': 'iscr',
        '\u22F5': 'isindot',
        '\u22F9': 'isinE',
        '\u22F4': 'isins',
        '\u22F3': 'isinsv',
        '\u0128': 'Itilde',
        '\u0129': 'itilde',
        '\u0406': 'Iukcy',
        '\u0456': 'iukcy',
        '\xCF': 'Iuml',
        '\xEF': 'iuml',
        '\u0134': 'Jcirc',
        '\u0135': 'jcirc',
        '\u0419': 'Jcy',
        '\u0439': 'jcy',
        '\uD835\uDD0D': 'Jfr',
        '\uD835\uDD27': 'jfr',
        '\u0237': 'jmath',
        '\uD835\uDD41': 'Jopf',
        '\uD835\uDD5B': 'jopf',
        '\uD835\uDCA5': 'Jscr',
        '\uD835\uDCBF': 'jscr',
        '\u0408': 'Jsercy',
        '\u0458': 'jsercy',
        '\u0404': 'Jukcy',
        '\u0454': 'jukcy',
        '\u039A': 'Kappa',
        '\u03BA': 'kappa',
        '\u03F0': 'kappav',
        '\u0136': 'Kcedil',
        '\u0137': 'kcedil',
        '\u041A': 'Kcy',
        '\u043A': 'kcy',
        '\uD835\uDD0E': 'Kfr',
        '\uD835\uDD28': 'kfr',
        '\u0138': 'kgreen',
        '\u0425': 'KHcy',
        '\u0445': 'khcy',
        '\u040C': 'KJcy',
        '\u045C': 'kjcy',
        '\uD835\uDD42': 'Kopf',
        '\uD835\uDD5C': 'kopf',
        '\uD835\uDCA6': 'Kscr',
        '\uD835\uDCC0': 'kscr',
        '\u21DA': 'lAarr',
        '\u0139': 'Lacute',
        '\u013A': 'lacute',
        '\u29B4': 'laemptyv',
        '\u2112': 'Lscr',
        '\u039B': 'Lambda',
        '\u03BB': 'lambda',
        '\u27E8': 'lang',
        '\u27EA': 'Lang',
        '\u2991': 'langd',
        '\u2A85': 'lap',
        '\xAB': 'laquo',
        '\u21E4': 'larrb',
        '\u291F': 'larrbfs',
        '\u2190': 'larr',
        '\u219E': 'Larr',
        '\u291D': 'larrfs',
        '\u21AB': 'larrlp',
        '\u2939': 'larrpl',
        '\u2973': 'larrsim',
        '\u21A2': 'larrtl',
        '\u2919': 'latail',
        '\u291B': 'lAtail',
        '\u2AAB': 'lat',
        '\u2AAD': 'late',
        '\u2AAD\uFE00': 'lates',
        '\u290C': 'lbarr',
        '\u290E': 'lBarr',
        '\u2772': 'lbbrk',
        '{': 'lcub',
        '[': 'lsqb',
        '\u298B': 'lbrke',
        '\u298F': 'lbrksld',
        '\u298D': 'lbrkslu',
        '\u013D': 'Lcaron',
        '\u013E': 'lcaron',
        '\u013B': 'Lcedil',
        '\u013C': 'lcedil',
        '\u2308': 'lceil',
        '\u041B': 'Lcy',
        '\u043B': 'lcy',
        '\u2936': 'ldca',
        '\u201C': 'ldquo',
        '\u2967': 'ldrdhar',
        '\u294B': 'ldrushar',
        '\u21B2': 'ldsh',
        '\u2264': 'le',
        '\u2266': 'lE',
        '\u21C6': 'lrarr',
        '\u27E6': 'lobrk',
        '\u2961': 'LeftDownTeeVector',
        '\u2959': 'LeftDownVectorBar',
        '\u230A': 'lfloor',
        '\u21BC': 'lharu',
        '\u21C7': 'llarr',
        '\u21CB': 'lrhar',
        '\u294E': 'LeftRightVector',
        '\u21A4': 'mapstoleft',
        '\u295A': 'LeftTeeVector',
        '\u22CB': 'lthree',
        '\u29CF': 'LeftTriangleBar',
        '\u22B2': 'vltri',
        '\u22B4': 'ltrie',
        '\u2951': 'LeftUpDownVector',
        '\u2960': 'LeftUpTeeVector',
        '\u2958': 'LeftUpVectorBar',
        '\u21BF': 'uharl',
        '\u2952': 'LeftVectorBar',
        '\u2A8B': 'lEg',
        '\u22DA': 'leg',
        '\u2A7D': 'les',
        '\u2AA8': 'lescc',
        '\u2A7F': 'lesdot',
        '\u2A81': 'lesdoto',
        '\u2A83': 'lesdotor',
        '\u22DA\uFE00': 'lesg',
        '\u2A93': 'lesges',
        '\u22D6': 'ltdot',
        '\u2276': 'lg',
        '\u2AA1': 'LessLess',
        '\u2272': 'lsim',
        '\u297C': 'lfisht',
        '\uD835\uDD0F': 'Lfr',
        '\uD835\uDD29': 'lfr',
        '\u2A91': 'lgE',
        '\u2962': 'lHar',
        '\u296A': 'lharul',
        '\u2584': 'lhblk',
        '\u0409': 'LJcy',
        '\u0459': 'ljcy',
        '\u226A': 'll',
        '\u22D8': 'Ll',
        '\u296B': 'llhard',
        '\u25FA': 'lltri',
        '\u013F': 'Lmidot',
        '\u0140': 'lmidot',
        '\u23B0': 'lmoust',
        '\u2A89': 'lnap',
        '\u2A87': 'lne',
        '\u2268': 'lnE',
        '\u22E6': 'lnsim',
        '\u27EC': 'loang',
        '\u21FD': 'loarr',
        '\u27F5': 'xlarr',
        '\u27F7': 'xharr',
        '\u27FC': 'xmap',
        '\u27F6': 'xrarr',
        '\u21AC': 'rarrlp',
        '\u2985': 'lopar',
        '\uD835\uDD43': 'Lopf',
        '\uD835\uDD5D': 'lopf',
        '\u2A2D': 'loplus',
        '\u2A34': 'lotimes',
        '\u2217': 'lowast',
        '_': 'lowbar',
        '\u2199': 'swarr',
        '\u2198': 'searr',
        '\u25CA': 'loz',
        '(': 'lpar',
        '\u2993': 'lparlt',
        '\u296D': 'lrhard',
        '\u200E': 'lrm',
        '\u22BF': 'lrtri',
        '\u2039': 'lsaquo',
        '\uD835\uDCC1': 'lscr',
        '\u21B0': 'lsh',
        '\u2A8D': 'lsime',
        '\u2A8F': 'lsimg',
        '\u2018': 'lsquo',
        '\u201A': 'sbquo',
        '\u0141': 'Lstrok',
        '\u0142': 'lstrok',
        '\u2AA6': 'ltcc',
        '\u2A79': 'ltcir',
        '<': 'lt',
        '\u22C9': 'ltimes',
        '\u2976': 'ltlarr',
        '\u2A7B': 'ltquest',
        '\u25C3': 'ltri',
        '\u2996': 'ltrPar',
        '\u294A': 'lurdshar',
        '\u2966': 'luruhar',
        '\u2268\uFE00': 'lvnE',
        '\xAF': 'macr',
        '\u2642': 'male',
        '\u2720': 'malt',
        '\u2905': 'Map',
        '\u21A6': 'map',
        '\u21A5': 'mapstoup',
        '\u25AE': 'marker',
        '\u2A29': 'mcomma',
        '\u041C': 'Mcy',
        '\u043C': 'mcy',
        '\u2014': 'mdash',
        '\u223A': 'mDDot',
        '\u205F': 'MediumSpace',
        '\u2133': 'Mscr',
        '\uD835\uDD10': 'Mfr',
        '\uD835\uDD2A': 'mfr',
        '\u2127': 'mho',
        '\xB5': 'micro',
        '\u2AF0': 'midcir',
        '\u2223': 'mid',
        '\u2212': 'minus',
        '\u2A2A': 'minusdu',
        '\u2213': 'mp',
        '\u2ADB': 'mlcp',
        '\u22A7': 'models',
        '\uD835\uDD44': 'Mopf',
        '\uD835\uDD5E': 'mopf',
        '\uD835\uDCC2': 'mscr',
        '\u039C': 'Mu',
        '\u03BC': 'mu',
        '\u22B8': 'mumap',
        '\u0143': 'Nacute',
        '\u0144': 'nacute',
        '\u2220\u20D2': 'nang',
        '\u2249': 'nap',
        '\u2A70\u0338': 'napE',
        '\u224B\u0338': 'napid',
        '\u0149': 'napos',
        '\u266E': 'natur',
        '\u2115': 'Nopf',
        '\xA0': 'nbsp',
        '\u224E\u0338': 'nbump',
        '\u224F\u0338': 'nbumpe',
        '\u2A43': 'ncap',
        '\u0147': 'Ncaron',
        '\u0148': 'ncaron',
        '\u0145': 'Ncedil',
        '\u0146': 'ncedil',
        '\u2247': 'ncong',
        '\u2A6D\u0338': 'ncongdot',
        '\u2A42': 'ncup',
        '\u041D': 'Ncy',
        '\u043D': 'ncy',
        '\u2013': 'ndash',
        '\u2924': 'nearhk',
        '\u2197': 'nearr',
        '\u21D7': 'neArr',
        '\u2260': 'ne',
        '\u2250\u0338': 'nedot',
        '\u200B': 'ZeroWidthSpace',
        '\u2262': 'nequiv',
        '\u2928': 'toea',
        '\u2242\u0338': 'nesim',
        '\n': 'NewLine',
        '\u2204': 'nexist',
        '\uD835\uDD11': 'Nfr',
        '\uD835\uDD2B': 'nfr',
        '\u2267\u0338': 'ngE',
        '\u2271': 'nge',
        '\u2A7E\u0338': 'nges',
        '\u22D9\u0338': 'nGg',
        '\u2275': 'ngsim',
        '\u226B\u20D2': 'nGt',
        '\u226F': 'ngt',
        '\u226B\u0338': 'nGtv',
        '\u21AE': 'nharr',
        '\u21CE': 'nhArr',
        '\u2AF2': 'nhpar',
        '\u220B': 'ni',
        '\u22FC': 'nis',
        '\u22FA': 'nisd',
        '\u040A': 'NJcy',
        '\u045A': 'njcy',
        '\u219A': 'nlarr',
        '\u21CD': 'nlArr',
        '\u2025': 'nldr',
        '\u2266\u0338': 'nlE',
        '\u2270': 'nle',
        '\u2A7D\u0338': 'nles',
        '\u226E': 'nlt',
        '\u22D8\u0338': 'nLl',
        '\u2274': 'nlsim',
        '\u226A\u20D2': 'nLt',
        '\u22EA': 'nltri',
        '\u22EC': 'nltrie',
        '\u226A\u0338': 'nLtv',
        '\u2224': 'nmid',
        '\u2060': 'NoBreak',
        '\uD835\uDD5F': 'nopf',
        '\u2AEC': 'Not',
        '\xAC': 'not',
        '\u226D': 'NotCupCap',
        '\u2226': 'npar',
        '\u2209': 'notin',
        '\u2279': 'ntgl',
        '\u22F5\u0338': 'notindot',
        '\u22F9\u0338': 'notinE',
        '\u22F7': 'notinvb',
        '\u22F6': 'notinvc',
        '\u29CF\u0338': 'NotLeftTriangleBar',
        '\u2278': 'ntlg',
        '\u2AA2\u0338': 'NotNestedGreaterGreater',
        '\u2AA1\u0338': 'NotNestedLessLess',
        '\u220C': 'notni',
        '\u22FE': 'notnivb',
        '\u22FD': 'notnivc',
        '\u2280': 'npr',
        '\u2AAF\u0338': 'npre',
        '\u22E0': 'nprcue',
        '\u29D0\u0338': 'NotRightTriangleBar',
        '\u22EB': 'nrtri',
        '\u22ED': 'nrtrie',
        '\u228F\u0338': 'NotSquareSubset',
        '\u22E2': 'nsqsube',
        '\u2290\u0338': 'NotSquareSuperset',
        '\u22E3': 'nsqsupe',
        '\u2282\u20D2': 'vnsub',
        '\u2288': 'nsube',
        '\u2281': 'nsc',
        '\u2AB0\u0338': 'nsce',
        '\u22E1': 'nsccue',
        '\u227F\u0338': 'NotSucceedsTilde',
        '\u2283\u20D2': 'vnsup',
        '\u2289': 'nsupe',
        '\u2241': 'nsim',
        '\u2244': 'nsime',
        '\u2AFD\u20E5': 'nparsl',
        '\u2202\u0338': 'npart',
        '\u2A14': 'npolint',
        '\u2933\u0338': 'nrarrc',
        '\u219B': 'nrarr',
        '\u21CF': 'nrArr',
        '\u219D\u0338': 'nrarrw',
        '\uD835\uDCA9': 'Nscr',
        '\uD835\uDCC3': 'nscr',
        '\u2284': 'nsub',
        '\u2AC5\u0338': 'nsubE',
        '\u2285': 'nsup',
        '\u2AC6\u0338': 'nsupE',
        '\xD1': 'Ntilde',
        '\xF1': 'ntilde',
        '\u039D': 'Nu',
        '\u03BD': 'nu',
        '#': 'num',
        '\u2116': 'numero',
        '\u2007': 'numsp',
        '\u224D\u20D2': 'nvap',
        '\u22AC': 'nvdash',
        '\u22AD': 'nvDash',
        '\u22AE': 'nVdash',
        '\u22AF': 'nVDash',
        '\u2265\u20D2': 'nvge',
        '>\u20D2': 'nvgt',
        '\u2904': 'nvHarr',
        '\u29DE': 'nvinfin',
        '\u2902': 'nvlArr',
        '\u2264\u20D2': 'nvle',
        '<\u20D2': 'nvlt',
        '\u22B4\u20D2': 'nvltrie',
        '\u2903': 'nvrArr',
        '\u22B5\u20D2': 'nvrtrie',
        '\u223C\u20D2': 'nvsim',
        '\u2923': 'nwarhk',
        '\u2196': 'nwarr',
        '\u21D6': 'nwArr',
        '\u2927': 'nwnear',
        '\xD3': 'Oacute',
        '\xF3': 'oacute',
        '\xD4': 'Ocirc',
        '\xF4': 'ocirc',
        '\u041E': 'Ocy',
        '\u043E': 'ocy',
        '\u0150': 'Odblac',
        '\u0151': 'odblac',
        '\u2A38': 'odiv',
        '\u29BC': 'odsold',
        '\u0152': 'OElig',
        '\u0153': 'oelig',
        '\u29BF': 'ofcir',
        '\uD835\uDD12': 'Ofr',
        '\uD835\uDD2C': 'ofr',
        '\u02DB': 'ogon',
        '\xD2': 'Ograve',
        '\xF2': 'ograve',
        '\u29C1': 'ogt',
        '\u29B5': 'ohbar',
        '\u03A9': 'ohm',
        '\u29BE': 'olcir',
        '\u29BB': 'olcross',
        '\u203E': 'oline',
        '\u29C0': 'olt',
        '\u014C': 'Omacr',
        '\u014D': 'omacr',
        '\u03C9': 'omega',
        '\u039F': 'Omicron',
        '\u03BF': 'omicron',
        '\u29B6': 'omid',
        '\uD835\uDD46': 'Oopf',
        '\uD835\uDD60': 'oopf',
        '\u29B7': 'opar',
        '\u29B9': 'operp',
        '\u2A54': 'Or',
        '\u2228': 'or',
        '\u2A5D': 'ord',
        '\u2134': 'oscr',
        '\xAA': 'ordf',
        '\xBA': 'ordm',
        '\u22B6': 'origof',
        '\u2A56': 'oror',
        '\u2A57': 'orslope',
        '\u2A5B': 'orv',
        '\uD835\uDCAA': 'Oscr',
        '\xD8': 'Oslash',
        '\xF8': 'oslash',
        '\u2298': 'osol',
        '\xD5': 'Otilde',
        '\xF5': 'otilde',
        '\u2A36': 'otimesas',
        '\u2A37': 'Otimes',
        '\xD6': 'Ouml',
        '\xF6': 'ouml',
        '\u233D': 'ovbar',
        '\u23DE': 'OverBrace',
        '\u23B4': 'tbrk',
        '\u23DC': 'OverParenthesis',
        '\xB6': 'para',
        '\u2AF3': 'parsim',
        '\u2AFD': 'parsl',
        '\u2202': 'part',
        '\u041F': 'Pcy',
        '\u043F': 'pcy',
        '%': 'percnt',
        '.': 'period',
        '\u2030': 'permil',
        '\u2031': 'pertenk',
        '\uD835\uDD13': 'Pfr',
        '\uD835\uDD2D': 'pfr',
        '\u03A6': 'Phi',
        '\u03C6': 'phi',
        '\u03D5': 'phiv',
        '\u260E': 'phone',
        '\u03A0': 'Pi',
        '\u03C0': 'pi',
        '\u03D6': 'piv',
        '\u210E': 'planckh',
        '\u2A23': 'plusacir',
        '\u2A22': 'pluscir',
        '+': 'plus',
        '\u2A25': 'plusdu',
        '\u2A72': 'pluse',
        '\xB1': 'pm',
        '\u2A26': 'plussim',
        '\u2A27': 'plustwo',
        '\u2A15': 'pointint',
        '\uD835\uDD61': 'popf',
        '\u2119': 'Popf',
        '\xA3': 'pound',
        '\u2AB7': 'prap',
        '\u2ABB': 'Pr',
        '\u227A': 'pr',
        '\u227C': 'prcue',
        '\u2AAF': 'pre',
        '\u227E': 'prsim',
        '\u2AB9': 'prnap',
        '\u2AB5': 'prnE',
        '\u22E8': 'prnsim',
        '\u2AB3': 'prE',
        '\u2032': 'prime',
        '\u2033': 'Prime',
        '\u220F': 'prod',
        '\u232E': 'profalar',
        '\u2312': 'profline',
        '\u2313': 'profsurf',
        '\u221D': 'prop',
        '\u22B0': 'prurel',
        '\uD835\uDCAB': 'Pscr',
        '\uD835\uDCC5': 'pscr',
        '\u03A8': 'Psi',
        '\u03C8': 'psi',
        '\u2008': 'puncsp',
        '\uD835\uDD14': 'Qfr',
        '\uD835\uDD2E': 'qfr',
        '\uD835\uDD62': 'qopf',
        '\u211A': 'Qopf',
        '\u2057': 'qprime',
        '\uD835\uDCAC': 'Qscr',
        '\uD835\uDCC6': 'qscr',
        '\u2A16': 'quatint',
        '?': 'quest',
        '"': 'quot',
        '\u21DB': 'rAarr',
        '\u223D\u0331': 'race',
        '\u0154': 'Racute',
        '\u0155': 'racute',
        '\u221A': 'Sqrt',
        '\u29B3': 'raemptyv',
        '\u27E9': 'rang',
        '\u27EB': 'Rang',
        '\u2992': 'rangd',
        '\u29A5': 'range',
        '\xBB': 'raquo',
        '\u2975': 'rarrap',
        '\u21E5': 'rarrb',
        '\u2920': 'rarrbfs',
        '\u2933': 'rarrc',
        '\u2192': 'rarr',
        '\u21A0': 'Rarr',
        '\u291E': 'rarrfs',
        '\u2945': 'rarrpl',
        '\u2974': 'rarrsim',
        '\u2916': 'Rarrtl',
        '\u21A3': 'rarrtl',
        '\u219D': 'rarrw',
        '\u291A': 'ratail',
        '\u291C': 'rAtail',
        '\u2236': 'ratio',
        '\u2773': 'rbbrk',
        '}': 'rcub',
        ']': 'rsqb',
        '\u298C': 'rbrke',
        '\u298E': 'rbrksld',
        '\u2990': 'rbrkslu',
        '\u0158': 'Rcaron',
        '\u0159': 'rcaron',
        '\u0156': 'Rcedil',
        '\u0157': 'rcedil',
        '\u2309': 'rceil',
        '\u0420': 'Rcy',
        '\u0440': 'rcy',
        '\u2937': 'rdca',
        '\u2969': 'rdldhar',
        '\u21B3': 'rdsh',
        '\u211C': 'Re',
        '\u211B': 'Rscr',
        '\u211D': 'Ropf',
        '\u25AD': 'rect',
        '\u297D': 'rfisht',
        '\u230B': 'rfloor',
        '\uD835\uDD2F': 'rfr',
        '\u2964': 'rHar',
        '\u21C0': 'rharu',
        '\u296C': 'rharul',
        '\u03A1': 'Rho',
        '\u03C1': 'rho',
        '\u03F1': 'rhov',
        '\u21C4': 'rlarr',
        '\u27E7': 'robrk',
        '\u295D': 'RightDownTeeVector',
        '\u2955': 'RightDownVectorBar',
        '\u21C9': 'rrarr',
        '\u22A2': 'vdash',
        '\u295B': 'RightTeeVector',
        '\u22CC': 'rthree',
        '\u29D0': 'RightTriangleBar',
        '\u22B3': 'vrtri',
        '\u22B5': 'rtrie',
        '\u294F': 'RightUpDownVector',
        '\u295C': 'RightUpTeeVector',
        '\u2954': 'RightUpVectorBar',
        '\u21BE': 'uharr',
        '\u2953': 'RightVectorBar',
        '\u02DA': 'ring',
        '\u200F': 'rlm',
        '\u23B1': 'rmoust',
        '\u2AEE': 'rnmid',
        '\u27ED': 'roang',
        '\u21FE': 'roarr',
        '\u2986': 'ropar',
        '\uD835\uDD63': 'ropf',
        '\u2A2E': 'roplus',
        '\u2A35': 'rotimes',
        '\u2970': 'RoundImplies',
        ')': 'rpar',
        '\u2994': 'rpargt',
        '\u2A12': 'rppolint',
        '\u203A': 'rsaquo',
        '\uD835\uDCC7': 'rscr',
        '\u21B1': 'rsh',
        '\u22CA': 'rtimes',
        '\u25B9': 'rtri',
        '\u29CE': 'rtriltri',
        '\u29F4': 'RuleDelayed',
        '\u2968': 'ruluhar',
        '\u211E': 'rx',
        '\u015A': 'Sacute',
        '\u015B': 'sacute',
        '\u2AB8': 'scap',
        '\u0160': 'Scaron',
        '\u0161': 'scaron',
        '\u2ABC': 'Sc',
        '\u227B': 'sc',
        '\u227D': 'sccue',
        '\u2AB0': 'sce',
        '\u2AB4': 'scE',
        '\u015E': 'Scedil',
        '\u015F': 'scedil',
        '\u015C': 'Scirc',
        '\u015D': 'scirc',
        '\u2ABA': 'scnap',
        '\u2AB6': 'scnE',
        '\u22E9': 'scnsim',
        '\u2A13': 'scpolint',
        '\u227F': 'scsim',
        '\u0421': 'Scy',
        '\u0441': 'scy',
        '\u22C5': 'sdot',
        '\u2A66': 'sdote',
        '\u21D8': 'seArr',
        '\xA7': 'sect',
        ';': 'semi',
        '\u2929': 'tosa',
        '\u2736': 'sext',
        '\uD835\uDD16': 'Sfr',
        '\uD835\uDD30': 'sfr',
        '\u266F': 'sharp',
        '\u0429': 'SHCHcy',
        '\u0449': 'shchcy',
        '\u0428': 'SHcy',
        '\u0448': 'shcy',
        '\u2191': 'uarr',
        '\xAD': 'shy',
        '\u03A3': 'Sigma',
        '\u03C3': 'sigma',
        '\u03C2': 'sigmaf',
        '\u223C': 'sim',
        '\u2A6A': 'simdot',
        '\u2243': 'sime',
        '\u2A9E': 'simg',
        '\u2AA0': 'simgE',
        '\u2A9D': 'siml',
        '\u2A9F': 'simlE',
        '\u2246': 'simne',
        '\u2A24': 'simplus',
        '\u2972': 'simrarr',
        '\u2A33': 'smashp',
        '\u29E4': 'smeparsl',
        '\u2323': 'smile',
        '\u2AAA': 'smt',
        '\u2AAC': 'smte',
        '\u2AAC\uFE00': 'smtes',
        '\u042C': 'SOFTcy',
        '\u044C': 'softcy',
        '\u233F': 'solbar',
        '\u29C4': 'solb',
        '/': 'sol',
        '\uD835\uDD4A': 'Sopf',
        '\uD835\uDD64': 'sopf',
        '\u2660': 'spades',
        '\u2293': 'sqcap',
        '\u2293\uFE00': 'sqcaps',
        '\u2294': 'sqcup',
        '\u2294\uFE00': 'sqcups',
        '\u228F': 'sqsub',
        '\u2291': 'sqsube',
        '\u2290': 'sqsup',
        '\u2292': 'sqsupe',
        '\u25A1': 'squ',
        '\uD835\uDCAE': 'Sscr',
        '\uD835\uDCC8': 'sscr',
        '\u22C6': 'Star',
        '\u2606': 'star',
        '\u2282': 'sub',
        '\u22D0': 'Sub',
        '\u2ABD': 'subdot',
        '\u2AC5': 'subE',
        '\u2286': 'sube',
        '\u2AC3': 'subedot',
        '\u2AC1': 'submult',
        '\u2ACB': 'subnE',
        '\u228A': 'subne',
        '\u2ABF': 'subplus',
        '\u2979': 'subrarr',
        '\u2AC7': 'subsim',
        '\u2AD5': 'subsub',
        '\u2AD3': 'subsup',
        '\u2211': 'sum',
        '\u266A': 'sung',
        '\xB9': 'sup1',
        '\xB2': 'sup2',
        '\xB3': 'sup3',
        '\u2283': 'sup',
        '\u22D1': 'Sup',
        '\u2ABE': 'supdot',
        '\u2AD8': 'supdsub',
        '\u2AC6': 'supE',
        '\u2287': 'supe',
        '\u2AC4': 'supedot',
        '\u27C9': 'suphsol',
        '\u2AD7': 'suphsub',
        '\u297B': 'suplarr',
        '\u2AC2': 'supmult',
        '\u2ACC': 'supnE',
        '\u228B': 'supne',
        '\u2AC0': 'supplus',
        '\u2AC8': 'supsim',
        '\u2AD4': 'supsub',
        '\u2AD6': 'supsup',
        '\u21D9': 'swArr',
        '\u292A': 'swnwar',
        '\xDF': 'szlig',
        '\t': 'Tab',
        '\u2316': 'target',
        '\u03A4': 'Tau',
        '\u03C4': 'tau',
        '\u0164': 'Tcaron',
        '\u0165': 'tcaron',
        '\u0162': 'Tcedil',
        '\u0163': 'tcedil',
        '\u0422': 'Tcy',
        '\u0442': 'tcy',
        '\u20DB': 'tdot',
        '\u2315': 'telrec',
        '\uD835\uDD17': 'Tfr',
        '\uD835\uDD31': 'tfr',
        '\u2234': 'there4',
        '\u0398': 'Theta',
        '\u03B8': 'theta',
        '\u03D1': 'thetav',
        '\u205F\u200A': 'ThickSpace',
        '\u2009': 'thinsp',
        '\xDE': 'THORN',
        '\xFE': 'thorn',
        '\u2A31': 'timesbar',
        '\xD7': 'times',
        '\u2A30': 'timesd',
        '\u2336': 'topbot',
        '\u2AF1': 'topcir',
        '\uD835\uDD4B': 'Topf',
        '\uD835\uDD65': 'topf',
        '\u2ADA': 'topfork',
        '\u2034': 'tprime',
        '\u2122': 'trade',
        '\u25B5': 'utri',
        '\u225C': 'trie',
        '\u25EC': 'tridot',
        '\u2A3A': 'triminus',
        '\u2A39': 'triplus',
        '\u29CD': 'trisb',
        '\u2A3B': 'tritime',
        '\u23E2': 'trpezium',
        '\uD835\uDCAF': 'Tscr',
        '\uD835\uDCC9': 'tscr',
        '\u0426': 'TScy',
        '\u0446': 'tscy',
        '\u040B': 'TSHcy',
        '\u045B': 'tshcy',
        '\u0166': 'Tstrok',
        '\u0167': 'tstrok',
        '\xDA': 'Uacute',
        '\xFA': 'uacute',
        '\u219F': 'Uarr',
        '\u2949': 'Uarrocir',
        '\u040E': 'Ubrcy',
        '\u045E': 'ubrcy',
        '\u016C': 'Ubreve',
        '\u016D': 'ubreve',
        '\xDB': 'Ucirc',
        '\xFB': 'ucirc',
        '\u0423': 'Ucy',
        '\u0443': 'ucy',
        '\u21C5': 'udarr',
        '\u0170': 'Udblac',
        '\u0171': 'udblac',
        '\u296E': 'udhar',
        '\u297E': 'ufisht',
        '\uD835\uDD18': 'Ufr',
        '\uD835\uDD32': 'ufr',
        '\xD9': 'Ugrave',
        '\xF9': 'ugrave',
        '\u2963': 'uHar',
        '\u2580': 'uhblk',
        '\u231C': 'ulcorn',
        '\u230F': 'ulcrop',
        '\u25F8': 'ultri',
        '\u016A': 'Umacr',
        '\u016B': 'umacr',
        '\u23DF': 'UnderBrace',
        '\u23DD': 'UnderParenthesis',
        '\u228E': 'uplus',
        '\u0172': 'Uogon',
        '\u0173': 'uogon',
        '\uD835\uDD4C': 'Uopf',
        '\uD835\uDD66': 'uopf',
        '\u2912': 'UpArrowBar',
        '\u2195': 'varr',
        '\u03C5': 'upsi',
        '\u03D2': 'Upsi',
        '\u03A5': 'Upsilon',
        '\u21C8': 'uuarr',
        '\u231D': 'urcorn',
        '\u230E': 'urcrop',
        '\u016E': 'Uring',
        '\u016F': 'uring',
        '\u25F9': 'urtri',
        '\uD835\uDCB0': 'Uscr',
        '\uD835\uDCCA': 'uscr',
        '\u22F0': 'utdot',
        '\u0168': 'Utilde',
        '\u0169': 'utilde',
        '\xDC': 'Uuml',
        '\xFC': 'uuml',
        '\u29A7': 'uwangle',
        '\u299C': 'vangrt',
        '\u228A\uFE00': 'vsubne',
        '\u2ACB\uFE00': 'vsubnE',
        '\u228B\uFE00': 'vsupne',
        '\u2ACC\uFE00': 'vsupnE',
        '\u2AE8': 'vBar',
        '\u2AEB': 'Vbar',
        '\u2AE9': 'vBarv',
        '\u0412': 'Vcy',
        '\u0432': 'vcy',
        '\u22A9': 'Vdash',
        '\u22AB': 'VDash',
        '\u2AE6': 'Vdashl',
        '\u22BB': 'veebar',
        '\u225A': 'veeeq',
        '\u22EE': 'vellip',
        '|': 'vert',
        '\u2016': 'Vert',
        '\u2758': 'VerticalSeparator',
        '\u2240': 'wr',
        '\uD835\uDD19': 'Vfr',
        '\uD835\uDD33': 'vfr',
        '\uD835\uDD4D': 'Vopf',
        '\uD835\uDD67': 'vopf',
        '\uD835\uDCB1': 'Vscr',
        '\uD835\uDCCB': 'vscr',
        '\u22AA': 'Vvdash',
        '\u299A': 'vzigzag',
        '\u0174': 'Wcirc',
        '\u0175': 'wcirc',
        '\u2A5F': 'wedbar',
        '\u2259': 'wedgeq',
        '\u2118': 'wp',
        '\uD835\uDD1A': 'Wfr',
        '\uD835\uDD34': 'wfr',
        '\uD835\uDD4E': 'Wopf',
        '\uD835\uDD68': 'wopf',
        '\uD835\uDCB2': 'Wscr',
        '\uD835\uDCCC': 'wscr',
        '\uD835\uDD1B': 'Xfr',
        '\uD835\uDD35': 'xfr',
        '\u039E': 'Xi',
        '\u03BE': 'xi',
        '\u22FB': 'xnis',
        '\uD835\uDD4F': 'Xopf',
        '\uD835\uDD69': 'xopf',
        '\uD835\uDCB3': 'Xscr',
        '\uD835\uDCCD': 'xscr',
        '\xDD': 'Yacute',
        '\xFD': 'yacute',
        '\u042F': 'YAcy',
        '\u044F': 'yacy',
        '\u0176': 'Ycirc',
        '\u0177': 'ycirc',
        '\u042B': 'Ycy',
        '\u044B': 'ycy',
        '\xA5': 'yen',
        '\uD835\uDD1C': 'Yfr',
        '\uD835\uDD36': 'yfr',
        '\u0407': 'YIcy',
        '\u0457': 'yicy',
        '\uD835\uDD50': 'Yopf',
        '\uD835\uDD6A': 'yopf',
        '\uD835\uDCB4': 'Yscr',
        '\uD835\uDCCE': 'yscr',
        '\u042E': 'YUcy',
        '\u044E': 'yucy',
        '\xFF': 'yuml',
        '\u0178': 'Yuml',
        '\u0179': 'Zacute',
        '\u017A': 'zacute',
        '\u017D': 'Zcaron',
        '\u017E': 'zcaron',
        '\u0417': 'Zcy',
        '\u0437': 'zcy',
        '\u017B': 'Zdot',
        '\u017C': 'zdot',
        '\u2128': 'Zfr',
        '\u0396': 'Zeta',
        '\u03B6': 'zeta',
        '\uD835\uDD37': 'zfr',
        '\u0416': 'ZHcy',
        '\u0436': 'zhcy',
        '\u21DD': 'zigrarr',
        '\uD835\uDD6B': 'zopf',
        '\uD835\uDCB5': 'Zscr',
        '\uD835\uDCCF': 'zscr',
        '\u200D': 'zwj',
        '\u200C': 'zwnj'
    };

    var regexEscape = /["&'<>`]/g;
    var escapeMap = {
        '"': '&quot;',
        '&': '&amp;',
        '\'': '&#x27;',
        '<': '&lt;',
        // See https://mathiasbynens.be/notes/ambiguous-ampersands: in HTML, the
        // following is not strictly necessary unless it’s part of a tag or an
        // unquoted attribute value. We’re only escaping it to support those
        // situations, and for XML support.
        '>': '&gt;',
        // In Internet Explorer ≤ 8, the backtick character can be used
        // to break out of (un)quoted attribute values or HTML comments.
        // See http://html5sec.org/#102, http://html5sec.org/#108, and
        // http://html5sec.org/#133.
        '`': '&#x60;'
    };

    var regexInvalidEntity = /&#(?:[xX][^a-fA-F0-9]|[^0-9xX])/;
    var regexInvalidRawCodePoint = /[\0-\x08\x0B\x0E-\x1F\x7F-\x9F\uFDD0-\uFDEF\uFFFE\uFFFF]|[\uD83F\uD87F\uD8BF\uD8FF\uD93F\uD97F\uD9BF\uD9FF\uDA3F\uDA7F\uDABF\uDAFF\uDB3F\uDB7F\uDBBF\uDBFF][\uDFFE\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
    var regexDecode = /&#([0-9]+)(;?)|&#[xX]([a-fA-F0-9]+)(;?)|&([0-9a-zA-Z]+);|&(Aacute|iacute|Uacute|plusmn|otilde|Otilde|Agrave|agrave|yacute|Yacute|oslash|Oslash|Atilde|atilde|brvbar|Ccedil|ccedil|ograve|curren|divide|Eacute|eacute|Ograve|oacute|Egrave|egrave|ugrave|frac12|frac14|frac34|Ugrave|Oacute|Iacute|ntilde|Ntilde|uacute|middot|Igrave|igrave|iquest|aacute|laquo|THORN|micro|iexcl|icirc|Icirc|Acirc|ucirc|ecirc|Ocirc|ocirc|Ecirc|Ucirc|aring|Aring|aelig|AElig|acute|pound|raquo|acirc|times|thorn|szlig|cedil|COPY|Auml|ordf|ordm|uuml|macr|Uuml|auml|Ouml|ouml|para|nbsp|Euml|quot|QUOT|euml|yuml|cent|sect|copy|sup1|sup2|sup3|Iuml|iuml|shy|eth|reg|not|yen|amp|AMP|REG|uml|ETH|deg|gt|GT|LT|lt)([=a-zA-Z0-9])?/g;
    var decodeMap = {
        'Aacute': '\xC1',
        'aacute': '\xE1',
        'Abreve': '\u0102',
        'abreve': '\u0103',
        'ac': '\u223E',
        'acd': '\u223F',
        'acE': '\u223E\u0333',
        'Acirc': '\xC2',
        'acirc': '\xE2',
        'acute': '\xB4',
        'Acy': '\u0410',
        'acy': '\u0430',
        'AElig': '\xC6',
        'aelig': '\xE6',
        'af': '\u2061',
        'Afr': '\uD835\uDD04',
        'afr': '\uD835\uDD1E',
        'Agrave': '\xC0',
        'agrave': '\xE0',
        'alefsym': '\u2135',
        'aleph': '\u2135',
        'Alpha': '\u0391',
        'alpha': '\u03B1',
        'Amacr': '\u0100',
        'amacr': '\u0101',
        'amalg': '\u2A3F',
        'amp': '&',
        'AMP': '&',
        'andand': '\u2A55',
        'And': '\u2A53',
        'and': '\u2227',
        'andd': '\u2A5C',
        'andslope': '\u2A58',
        'andv': '\u2A5A',
        'ang': '\u2220',
        'ange': '\u29A4',
        'angle': '\u2220',
        'angmsdaa': '\u29A8',
        'angmsdab': '\u29A9',
        'angmsdac': '\u29AA',
        'angmsdad': '\u29AB',
        'angmsdae': '\u29AC',
        'angmsdaf': '\u29AD',
        'angmsdag': '\u29AE',
        'angmsdah': '\u29AF',
        'angmsd': '\u2221',
        'angrt': '\u221F',
        'angrtvb': '\u22BE',
        'angrtvbd': '\u299D',
        'angsph': '\u2222',
        'angst': '\xC5',
        'angzarr': '\u237C',
        'Aogon': '\u0104',
        'aogon': '\u0105',
        'Aopf': '\uD835\uDD38',
        'aopf': '\uD835\uDD52',
        'apacir': '\u2A6F',
        'ap': '\u2248',
        'apE': '\u2A70',
        'ape': '\u224A',
        'apid': '\u224B',
        'apos': '\'',
        'ApplyFunction': '\u2061',
        'approx': '\u2248',
        'approxeq': '\u224A',
        'Aring': '\xC5',
        'aring': '\xE5',
        'Ascr': '\uD835\uDC9C',
        'ascr': '\uD835\uDCB6',
        'Assign': '\u2254',
        'ast': '*',
        'asymp': '\u2248',
        'asympeq': '\u224D',
        'Atilde': '\xC3',
        'atilde': '\xE3',
        'Auml': '\xC4',
        'auml': '\xE4',
        'awconint': '\u2233',
        'awint': '\u2A11',
        'backcong': '\u224C',
        'backepsilon': '\u03F6',
        'backprime': '\u2035',
        'backsim': '\u223D',
        'backsimeq': '\u22CD',
        'Backslash': '\u2216',
        'Barv': '\u2AE7',
        'barvee': '\u22BD',
        'barwed': '\u2305',
        'Barwed': '\u2306',
        'barwedge': '\u2305',
        'bbrk': '\u23B5',
        'bbrktbrk': '\u23B6',
        'bcong': '\u224C',
        'Bcy': '\u0411',
        'bcy': '\u0431',
        'bdquo': '\u201E',
        'becaus': '\u2235',
        'because': '\u2235',
        'Because': '\u2235',
        'bemptyv': '\u29B0',
        'bepsi': '\u03F6',
        'bernou': '\u212C',
        'Bernoullis': '\u212C',
        'Beta': '\u0392',
        'beta': '\u03B2',
        'beth': '\u2136',
        'between': '\u226C',
        'Bfr': '\uD835\uDD05',
        'bfr': '\uD835\uDD1F',
        'bigcap': '\u22C2',
        'bigcirc': '\u25EF',
        'bigcup': '\u22C3',
        'bigodot': '\u2A00',
        'bigoplus': '\u2A01',
        'bigotimes': '\u2A02',
        'bigsqcup': '\u2A06',
        'bigstar': '\u2605',
        'bigtriangledown': '\u25BD',
        'bigtriangleup': '\u25B3',
        'biguplus': '\u2A04',
        'bigvee': '\u22C1',
        'bigwedge': '\u22C0',
        'bkarow': '\u290D',
        'blacklozenge': '\u29EB',
        'blacksquare': '\u25AA',
        'blacktriangle': '\u25B4',
        'blacktriangledown': '\u25BE',
        'blacktriangleleft': '\u25C2',
        'blacktriangleright': '\u25B8',
        'blank': '\u2423',
        'blk12': '\u2592',
        'blk14': '\u2591',
        'blk34': '\u2593',
        'block': '\u2588',
        'bne': '=\u20E5',
        'bnequiv': '\u2261\u20E5',
        'bNot': '\u2AED',
        'bnot': '\u2310',
        'Bopf': '\uD835\uDD39',
        'bopf': '\uD835\uDD53',
        'bot': '\u22A5',
        'bottom': '\u22A5',
        'bowtie': '\u22C8',
        'boxbox': '\u29C9',
        'boxdl': '\u2510',
        'boxdL': '\u2555',
        'boxDl': '\u2556',
        'boxDL': '\u2557',
        'boxdr': '\u250C',
        'boxdR': '\u2552',
        'boxDr': '\u2553',
        'boxDR': '\u2554',
        'boxh': '\u2500',
        'boxH': '\u2550',
        'boxhd': '\u252C',
        'boxHd': '\u2564',
        'boxhD': '\u2565',
        'boxHD': '\u2566',
        'boxhu': '\u2534',
        'boxHu': '\u2567',
        'boxhU': '\u2568',
        'boxHU': '\u2569',
        'boxminus': '\u229F',
        'boxplus': '\u229E',
        'boxtimes': '\u22A0',
        'boxul': '\u2518',
        'boxuL': '\u255B',
        'boxUl': '\u255C',
        'boxUL': '\u255D',
        'boxur': '\u2514',
        'boxuR': '\u2558',
        'boxUr': '\u2559',
        'boxUR': '\u255A',
        'boxv': '\u2502',
        'boxV': '\u2551',
        'boxvh': '\u253C',
        'boxvH': '\u256A',
        'boxVh': '\u256B',
        'boxVH': '\u256C',
        'boxvl': '\u2524',
        'boxvL': '\u2561',
        'boxVl': '\u2562',
        'boxVL': '\u2563',
        'boxvr': '\u251C',
        'boxvR': '\u255E',
        'boxVr': '\u255F',
        'boxVR': '\u2560',
        'bprime': '\u2035',
        'breve': '\u02D8',
        'Breve': '\u02D8',
        'brvbar': '\xA6',
        'bscr': '\uD835\uDCB7',
        'Bscr': '\u212C',
        'bsemi': '\u204F',
        'bsim': '\u223D',
        'bsime': '\u22CD',
        'bsolb': '\u29C5',
        'bsol': '\\',
        'bsolhsub': '\u27C8',
        'bull': '\u2022',
        'bullet': '\u2022',
        'bump': '\u224E',
        'bumpE': '\u2AAE',
        'bumpe': '\u224F',
        'Bumpeq': '\u224E',
        'bumpeq': '\u224F',
        'Cacute': '\u0106',
        'cacute': '\u0107',
        'capand': '\u2A44',
        'capbrcup': '\u2A49',
        'capcap': '\u2A4B',
        'cap': '\u2229',
        'Cap': '\u22D2',
        'capcup': '\u2A47',
        'capdot': '\u2A40',
        'CapitalDifferentialD': '\u2145',
        'caps': '\u2229\uFE00',
        'caret': '\u2041',
        'caron': '\u02C7',
        'Cayleys': '\u212D',
        'ccaps': '\u2A4D',
        'Ccaron': '\u010C',
        'ccaron': '\u010D',
        'Ccedil': '\xC7',
        'ccedil': '\xE7',
        'Ccirc': '\u0108',
        'ccirc': '\u0109',
        'Cconint': '\u2230',
        'ccups': '\u2A4C',
        'ccupssm': '\u2A50',
        'Cdot': '\u010A',
        'cdot': '\u010B',
        'cedil': '\xB8',
        'Cedilla': '\xB8',
        'cemptyv': '\u29B2',
        'cent': '\xA2',
        'centerdot': '\xB7',
        'CenterDot': '\xB7',
        'cfr': '\uD835\uDD20',
        'Cfr': '\u212D',
        'CHcy': '\u0427',
        'chcy': '\u0447',
        'check': '\u2713',
        'checkmark': '\u2713',
        'Chi': '\u03A7',
        'chi': '\u03C7',
        'circ': '\u02C6',
        'circeq': '\u2257',
        'circlearrowleft': '\u21BA',
        'circlearrowright': '\u21BB',
        'circledast': '\u229B',
        'circledcirc': '\u229A',
        'circleddash': '\u229D',
        'CircleDot': '\u2299',
        'circledR': '\xAE',
        'circledS': '\u24C8',
        'CircleMinus': '\u2296',
        'CirclePlus': '\u2295',
        'CircleTimes': '\u2297',
        'cir': '\u25CB',
        'cirE': '\u29C3',
        'cire': '\u2257',
        'cirfnint': '\u2A10',
        'cirmid': '\u2AEF',
        'cirscir': '\u29C2',
        'ClockwiseContourIntegral': '\u2232',
        'CloseCurlyDoubleQuote': '\u201D',
        'CloseCurlyQuote': '\u2019',
        'clubs': '\u2663',
        'clubsuit': '\u2663',
        'colon': ':',
        'Colon': '\u2237',
        'Colone': '\u2A74',
        'colone': '\u2254',
        'coloneq': '\u2254',
        'comma': ',',
        'commat': '@',
        'comp': '\u2201',
        'compfn': '\u2218',
        'complement': '\u2201',
        'complexes': '\u2102',
        'cong': '\u2245',
        'congdot': '\u2A6D',
        'Congruent': '\u2261',
        'conint': '\u222E',
        'Conint': '\u222F',
        'ContourIntegral': '\u222E',
        'copf': '\uD835\uDD54',
        'Copf': '\u2102',
        'coprod': '\u2210',
        'Coproduct': '\u2210',
        'copy': '\xA9',
        'COPY': '\xA9',
        'copysr': '\u2117',
        'CounterClockwiseContourIntegral': '\u2233',
        'crarr': '\u21B5',
        'cross': '\u2717',
        'Cross': '\u2A2F',
        'Cscr': '\uD835\uDC9E',
        'cscr': '\uD835\uDCB8',
        'csub': '\u2ACF',
        'csube': '\u2AD1',
        'csup': '\u2AD0',
        'csupe': '\u2AD2',
        'ctdot': '\u22EF',
        'cudarrl': '\u2938',
        'cudarrr': '\u2935',
        'cuepr': '\u22DE',
        'cuesc': '\u22DF',
        'cularr': '\u21B6',
        'cularrp': '\u293D',
        'cupbrcap': '\u2A48',
        'cupcap': '\u2A46',
        'CupCap': '\u224D',
        'cup': '\u222A',
        'Cup': '\u22D3',
        'cupcup': '\u2A4A',
        'cupdot': '\u228D',
        'cupor': '\u2A45',
        'cups': '\u222A\uFE00',
        'curarr': '\u21B7',
        'curarrm': '\u293C',
        'curlyeqprec': '\u22DE',
        'curlyeqsucc': '\u22DF',
        'curlyvee': '\u22CE',
        'curlywedge': '\u22CF',
        'curren': '\xA4',
        'curvearrowleft': '\u21B6',
        'curvearrowright': '\u21B7',
        'cuvee': '\u22CE',
        'cuwed': '\u22CF',
        'cwconint': '\u2232',
        'cwint': '\u2231',
        'cylcty': '\u232D',
        'dagger': '\u2020',
        'Dagger': '\u2021',
        'daleth': '\u2138',
        'darr': '\u2193',
        'Darr': '\u21A1',
        'dArr': '\u21D3',
        'dash': '\u2010',
        'Dashv': '\u2AE4',
        'dashv': '\u22A3',
        'dbkarow': '\u290F',
        'dblac': '\u02DD',
        'Dcaron': '\u010E',
        'dcaron': '\u010F',
        'Dcy': '\u0414',
        'dcy': '\u0434',
        'ddagger': '\u2021',
        'ddarr': '\u21CA',
        'DD': '\u2145',
        'dd': '\u2146',
        'DDotrahd': '\u2911',
        'ddotseq': '\u2A77',
        'deg': '\xB0',
        'Del': '\u2207',
        'Delta': '\u0394',
        'delta': '\u03B4',
        'demptyv': '\u29B1',
        'dfisht': '\u297F',
        'Dfr': '\uD835\uDD07',
        'dfr': '\uD835\uDD21',
        'dHar': '\u2965',
        'dharl': '\u21C3',
        'dharr': '\u21C2',
        'DiacriticalAcute': '\xB4',
        'DiacriticalDot': '\u02D9',
        'DiacriticalDoubleAcute': '\u02DD',
        'DiacriticalGrave': '`',
        'DiacriticalTilde': '\u02DC',
        'diam': '\u22C4',
        'diamond': '\u22C4',
        'Diamond': '\u22C4',
        'diamondsuit': '\u2666',
        'diams': '\u2666',
        'die': '\xA8',
        'DifferentialD': '\u2146',
        'digamma': '\u03DD',
        'disin': '\u22F2',
        'div': '\xF7',
        'divide': '\xF7',
        'divideontimes': '\u22C7',
        'divonx': '\u22C7',
        'DJcy': '\u0402',
        'djcy': '\u0452',
        'dlcorn': '\u231E',
        'dlcrop': '\u230D',
        'dollar': '$',
        'Dopf': '\uD835\uDD3B',
        'dopf': '\uD835\uDD55',
        'Dot': '\xA8',
        'dot': '\u02D9',
        'DotDot': '\u20DC',
        'doteq': '\u2250',
        'doteqdot': '\u2251',
        'DotEqual': '\u2250',
        'dotminus': '\u2238',
        'dotplus': '\u2214',
        'dotsquare': '\u22A1',
        'doublebarwedge': '\u2306',
        'DoubleContourIntegral': '\u222F',
        'DoubleDot': '\xA8',
        'DoubleDownArrow': '\u21D3',
        'DoubleLeftArrow': '\u21D0',
        'DoubleLeftRightArrow': '\u21D4',
        'DoubleLeftTee': '\u2AE4',
        'DoubleLongLeftArrow': '\u27F8',
        'DoubleLongLeftRightArrow': '\u27FA',
        'DoubleLongRightArrow': '\u27F9',
        'DoubleRightArrow': '\u21D2',
        'DoubleRightTee': '\u22A8',
        'DoubleUpArrow': '\u21D1',
        'DoubleUpDownArrow': '\u21D5',
        'DoubleVerticalBar': '\u2225',
        'DownArrowBar': '\u2913',
        'downarrow': '\u2193',
        'DownArrow': '\u2193',
        'Downarrow': '\u21D3',
        'DownArrowUpArrow': '\u21F5',
        'DownBreve': '\u0311',
        'downdownarrows': '\u21CA',
        'downharpoonleft': '\u21C3',
        'downharpoonright': '\u21C2',
        'DownLeftRightVector': '\u2950',
        'DownLeftTeeVector': '\u295E',
        'DownLeftVectorBar': '\u2956',
        'DownLeftVector': '\u21BD',
        'DownRightTeeVector': '\u295F',
        'DownRightVectorBar': '\u2957',
        'DownRightVector': '\u21C1',
        'DownTeeArrow': '\u21A7',
        'DownTee': '\u22A4',
        'drbkarow': '\u2910',
        'drcorn': '\u231F',
        'drcrop': '\u230C',
        'Dscr': '\uD835\uDC9F',
        'dscr': '\uD835\uDCB9',
        'DScy': '\u0405',
        'dscy': '\u0455',
        'dsol': '\u29F6',
        'Dstrok': '\u0110',
        'dstrok': '\u0111',
        'dtdot': '\u22F1',
        'dtri': '\u25BF',
        'dtrif': '\u25BE',
        'duarr': '\u21F5',
        'duhar': '\u296F',
        'dwangle': '\u29A6',
        'DZcy': '\u040F',
        'dzcy': '\u045F',
        'dzigrarr': '\u27FF',
        'Eacute': '\xC9',
        'eacute': '\xE9',
        'easter': '\u2A6E',
        'Ecaron': '\u011A',
        'ecaron': '\u011B',
        'Ecirc': '\xCA',
        'ecirc': '\xEA',
        'ecir': '\u2256',
        'ecolon': '\u2255',
        'Ecy': '\u042D',
        'ecy': '\u044D',
        'eDDot': '\u2A77',
        'Edot': '\u0116',
        'edot': '\u0117',
        'eDot': '\u2251',
        'ee': '\u2147',
        'efDot': '\u2252',
        'Efr': '\uD835\uDD08',
        'efr': '\uD835\uDD22',
        'eg': '\u2A9A',
        'Egrave': '\xC8',
        'egrave': '\xE8',
        'egs': '\u2A96',
        'egsdot': '\u2A98',
        'el': '\u2A99',
        'Element': '\u2208',
        'elinters': '\u23E7',
        'ell': '\u2113',
        'els': '\u2A95',
        'elsdot': '\u2A97',
        'Emacr': '\u0112',
        'emacr': '\u0113',
        'empty': '\u2205',
        'emptyset': '\u2205',
        'EmptySmallSquare': '\u25FB',
        'emptyv': '\u2205',
        'EmptyVerySmallSquare': '\u25AB',
        'emsp13': '\u2004',
        'emsp14': '\u2005',
        'emsp': '\u2003',
        'ENG': '\u014A',
        'eng': '\u014B',
        'ensp': '\u2002',
        'Eogon': '\u0118',
        'eogon': '\u0119',
        'Eopf': '\uD835\uDD3C',
        'eopf': '\uD835\uDD56',
        'epar': '\u22D5',
        'eparsl': '\u29E3',
        'eplus': '\u2A71',
        'epsi': '\u03B5',
        'Epsilon': '\u0395',
        'epsilon': '\u03B5',
        'epsiv': '\u03F5',
        'eqcirc': '\u2256',
        'eqcolon': '\u2255',
        'eqsim': '\u2242',
        'eqslantgtr': '\u2A96',
        'eqslantless': '\u2A95',
        'Equal': '\u2A75',
        'equals': '=',
        'EqualTilde': '\u2242',
        'equest': '\u225F',
        'Equilibrium': '\u21CC',
        'equiv': '\u2261',
        'equivDD': '\u2A78',
        'eqvparsl': '\u29E5',
        'erarr': '\u2971',
        'erDot': '\u2253',
        'escr': '\u212F',
        'Escr': '\u2130',
        'esdot': '\u2250',
        'Esim': '\u2A73',
        'esim': '\u2242',
        'Eta': '\u0397',
        'eta': '\u03B7',
        'ETH': '\xD0',
        'eth': '\xF0',
        'Euml': '\xCB',
        'euml': '\xEB',
        'euro': '\u20AC',
        'excl': '!',
        'exist': '\u2203',
        'Exists': '\u2203',
        'expectation': '\u2130',
        'exponentiale': '\u2147',
        'ExponentialE': '\u2147',
        'fallingdotseq': '\u2252',
        'Fcy': '\u0424',
        'fcy': '\u0444',
        'female': '\u2640',
        'ffilig': '\uFB03',
        'fflig': '\uFB00',
        'ffllig': '\uFB04',
        'Ffr': '\uD835\uDD09',
        'ffr': '\uD835\uDD23',
        'filig': '\uFB01',
        'FilledSmallSquare': '\u25FC',
        'FilledVerySmallSquare': '\u25AA',
        'fjlig': 'fj',
        'flat': '\u266D',
        'fllig': '\uFB02',
        'fltns': '\u25B1',
        'fnof': '\u0192',
        'Fopf': '\uD835\uDD3D',
        'fopf': '\uD835\uDD57',
        'forall': '\u2200',
        'ForAll': '\u2200',
        'fork': '\u22D4',
        'forkv': '\u2AD9',
        'Fouriertrf': '\u2131',
        'fpartint': '\u2A0D',
        'frac12': '\xBD',
        'frac13': '\u2153',
        'frac14': '\xBC',
        'frac15': '\u2155',
        'frac16': '\u2159',
        'frac18': '\u215B',
        'frac23': '\u2154',
        'frac25': '\u2156',
        'frac34': '\xBE',
        'frac35': '\u2157',
        'frac38': '\u215C',
        'frac45': '\u2158',
        'frac56': '\u215A',
        'frac58': '\u215D',
        'frac78': '\u215E',
        'frasl': '\u2044',
        'frown': '\u2322',
        'fscr': '\uD835\uDCBB',
        'Fscr': '\u2131',
        'gacute': '\u01F5',
        'Gamma': '\u0393',
        'gamma': '\u03B3',
        'Gammad': '\u03DC',
        'gammad': '\u03DD',
        'gap': '\u2A86',
        'Gbreve': '\u011E',
        'gbreve': '\u011F',
        'Gcedil': '\u0122',
        'Gcirc': '\u011C',
        'gcirc': '\u011D',
        'Gcy': '\u0413',
        'gcy': '\u0433',
        'Gdot': '\u0120',
        'gdot': '\u0121',
        'ge': '\u2265',
        'gE': '\u2267',
        'gEl': '\u2A8C',
        'gel': '\u22DB',
        'geq': '\u2265',
        'geqq': '\u2267',
        'geqslant': '\u2A7E',
        'gescc': '\u2AA9',
        'ges': '\u2A7E',
        'gesdot': '\u2A80',
        'gesdoto': '\u2A82',
        'gesdotol': '\u2A84',
        'gesl': '\u22DB\uFE00',
        'gesles': '\u2A94',
        'Gfr': '\uD835\uDD0A',
        'gfr': '\uD835\uDD24',
        'gg': '\u226B',
        'Gg': '\u22D9',
        'ggg': '\u22D9',
        'gimel': '\u2137',
        'GJcy': '\u0403',
        'gjcy': '\u0453',
        'gla': '\u2AA5',
        'gl': '\u2277',
        'glE': '\u2A92',
        'glj': '\u2AA4',
        'gnap': '\u2A8A',
        'gnapprox': '\u2A8A',
        'gne': '\u2A88',
        'gnE': '\u2269',
        'gneq': '\u2A88',
        'gneqq': '\u2269',
        'gnsim': '\u22E7',
        'Gopf': '\uD835\uDD3E',
        'gopf': '\uD835\uDD58',
        'grave': '`',
        'GreaterEqual': '\u2265',
        'GreaterEqualLess': '\u22DB',
        'GreaterFullEqual': '\u2267',
        'GreaterGreater': '\u2AA2',
        'GreaterLess': '\u2277',
        'GreaterSlantEqual': '\u2A7E',
        'GreaterTilde': '\u2273',
        'Gscr': '\uD835\uDCA2',
        'gscr': '\u210A',
        'gsim': '\u2273',
        'gsime': '\u2A8E',
        'gsiml': '\u2A90',
        'gtcc': '\u2AA7',
        'gtcir': '\u2A7A',
        'gt': '>',
        'GT': '>',
        'Gt': '\u226B',
        'gtdot': '\u22D7',
        'gtlPar': '\u2995',
        'gtquest': '\u2A7C',
        'gtrapprox': '\u2A86',
        'gtrarr': '\u2978',
        'gtrdot': '\u22D7',
        'gtreqless': '\u22DB',
        'gtreqqless': '\u2A8C',
        'gtrless': '\u2277',
        'gtrsim': '\u2273',
        'gvertneqq': '\u2269\uFE00',
        'gvnE': '\u2269\uFE00',
        'Hacek': '\u02C7',
        'hairsp': '\u200A',
        'half': '\xBD',
        'hamilt': '\u210B',
        'HARDcy': '\u042A',
        'hardcy': '\u044A',
        'harrcir': '\u2948',
        'harr': '\u2194',
        'hArr': '\u21D4',
        'harrw': '\u21AD',
        'Hat': '^',
        'hbar': '\u210F',
        'Hcirc': '\u0124',
        'hcirc': '\u0125',
        'hearts': '\u2665',
        'heartsuit': '\u2665',
        'hellip': '\u2026',
        'hercon': '\u22B9',
        'hfr': '\uD835\uDD25',
        'Hfr': '\u210C',
        'HilbertSpace': '\u210B',
        'hksearow': '\u2925',
        'hkswarow': '\u2926',
        'hoarr': '\u21FF',
        'homtht': '\u223B',
        'hookleftarrow': '\u21A9',
        'hookrightarrow': '\u21AA',
        'hopf': '\uD835\uDD59',
        'Hopf': '\u210D',
        'horbar': '\u2015',
        'HorizontalLine': '\u2500',
        'hscr': '\uD835\uDCBD',
        'Hscr': '\u210B',
        'hslash': '\u210F',
        'Hstrok': '\u0126',
        'hstrok': '\u0127',
        'HumpDownHump': '\u224E',
        'HumpEqual': '\u224F',
        'hybull': '\u2043',
        'hyphen': '\u2010',
        'Iacute': '\xCD',
        'iacute': '\xED',
        'ic': '\u2063',
        'Icirc': '\xCE',
        'icirc': '\xEE',
        'Icy': '\u0418',
        'icy': '\u0438',
        'Idot': '\u0130',
        'IEcy': '\u0415',
        'iecy': '\u0435',
        'iexcl': '\xA1',
        'iff': '\u21D4',
        'ifr': '\uD835\uDD26',
        'Ifr': '\u2111',
        'Igrave': '\xCC',
        'igrave': '\xEC',
        'ii': '\u2148',
        'iiiint': '\u2A0C',
        'iiint': '\u222D',
        'iinfin': '\u29DC',
        'iiota': '\u2129',
        'IJlig': '\u0132',
        'ijlig': '\u0133',
        'Imacr': '\u012A',
        'imacr': '\u012B',
        'image': '\u2111',
        'ImaginaryI': '\u2148',
        'imagline': '\u2110',
        'imagpart': '\u2111',
        'imath': '\u0131',
        'Im': '\u2111',
        'imof': '\u22B7',
        'imped': '\u01B5',
        'Implies': '\u21D2',
        'incare': '\u2105',
        'in': '\u2208',
        'infin': '\u221E',
        'infintie': '\u29DD',
        'inodot': '\u0131',
        'intcal': '\u22BA',
        'int': '\u222B',
        'Int': '\u222C',
        'integers': '\u2124',
        'Integral': '\u222B',
        'intercal': '\u22BA',
        'Intersection': '\u22C2',
        'intlarhk': '\u2A17',
        'intprod': '\u2A3C',
        'InvisibleComma': '\u2063',
        'InvisibleTimes': '\u2062',
        'IOcy': '\u0401',
        'iocy': '\u0451',
        'Iogon': '\u012E',
        'iogon': '\u012F',
        'Iopf': '\uD835\uDD40',
        'iopf': '\uD835\uDD5A',
        'Iota': '\u0399',
        'iota': '\u03B9',
        'iprod': '\u2A3C',
        'iquest': '\xBF',
        'iscr': '\uD835\uDCBE',
        'Iscr': '\u2110',
        'isin': '\u2208',
        'isindot': '\u22F5',
        'isinE': '\u22F9',
        'isins': '\u22F4',
        'isinsv': '\u22F3',
        'isinv': '\u2208',
        'it': '\u2062',
        'Itilde': '\u0128',
        'itilde': '\u0129',
        'Iukcy': '\u0406',
        'iukcy': '\u0456',
        'Iuml': '\xCF',
        'iuml': '\xEF',
        'Jcirc': '\u0134',
        'jcirc': '\u0135',
        'Jcy': '\u0419',
        'jcy': '\u0439',
        'Jfr': '\uD835\uDD0D',
        'jfr': '\uD835\uDD27',
        'jmath': '\u0237',
        'Jopf': '\uD835\uDD41',
        'jopf': '\uD835\uDD5B',
        'Jscr': '\uD835\uDCA5',
        'jscr': '\uD835\uDCBF',
        'Jsercy': '\u0408',
        'jsercy': '\u0458',
        'Jukcy': '\u0404',
        'jukcy': '\u0454',
        'Kappa': '\u039A',
        'kappa': '\u03BA',
        'kappav': '\u03F0',
        'Kcedil': '\u0136',
        'kcedil': '\u0137',
        'Kcy': '\u041A',
        'kcy': '\u043A',
        'Kfr': '\uD835\uDD0E',
        'kfr': '\uD835\uDD28',
        'kgreen': '\u0138',
        'KHcy': '\u0425',
        'khcy': '\u0445',
        'KJcy': '\u040C',
        'kjcy': '\u045C',
        'Kopf': '\uD835\uDD42',
        'kopf': '\uD835\uDD5C',
        'Kscr': '\uD835\uDCA6',
        'kscr': '\uD835\uDCC0',
        'lAarr': '\u21DA',
        'Lacute': '\u0139',
        'lacute': '\u013A',
        'laemptyv': '\u29B4',
        'lagran': '\u2112',
        'Lambda': '\u039B',
        'lambda': '\u03BB',
        'lang': '\u27E8',
        'Lang': '\u27EA',
        'langd': '\u2991',
        'langle': '\u27E8',
        'lap': '\u2A85',
        'Laplacetrf': '\u2112',
        'laquo': '\xAB',
        'larrb': '\u21E4',
        'larrbfs': '\u291F',
        'larr': '\u2190',
        'Larr': '\u219E',
        'lArr': '\u21D0',
        'larrfs': '\u291D',
        'larrhk': '\u21A9',
        'larrlp': '\u21AB',
        'larrpl': '\u2939',
        'larrsim': '\u2973',
        'larrtl': '\u21A2',
        'latail': '\u2919',
        'lAtail': '\u291B',
        'lat': '\u2AAB',
        'late': '\u2AAD',
        'lates': '\u2AAD\uFE00',
        'lbarr': '\u290C',
        'lBarr': '\u290E',
        'lbbrk': '\u2772',
        'lbrace': '{',
        'lbrack': '[',
        'lbrke': '\u298B',
        'lbrksld': '\u298F',
        'lbrkslu': '\u298D',
        'Lcaron': '\u013D',
        'lcaron': '\u013E',
        'Lcedil': '\u013B',
        'lcedil': '\u013C',
        'lceil': '\u2308',
        'lcub': '{',
        'Lcy': '\u041B',
        'lcy': '\u043B',
        'ldca': '\u2936',
        'ldquo': '\u201C',
        'ldquor': '\u201E',
        'ldrdhar': '\u2967',
        'ldrushar': '\u294B',
        'ldsh': '\u21B2',
        'le': '\u2264',
        'lE': '\u2266',
        'LeftAngleBracket': '\u27E8',
        'LeftArrowBar': '\u21E4',
        'leftarrow': '\u2190',
        'LeftArrow': '\u2190',
        'Leftarrow': '\u21D0',
        'LeftArrowRightArrow': '\u21C6',
        'leftarrowtail': '\u21A2',
        'LeftCeiling': '\u2308',
        'LeftDoubleBracket': '\u27E6',
        'LeftDownTeeVector': '\u2961',
        'LeftDownVectorBar': '\u2959',
        'LeftDownVector': '\u21C3',
        'LeftFloor': '\u230A',
        'leftharpoondown': '\u21BD',
        'leftharpoonup': '\u21BC',
        'leftleftarrows': '\u21C7',
        'leftrightarrow': '\u2194',
        'LeftRightArrow': '\u2194',
        'Leftrightarrow': '\u21D4',
        'leftrightarrows': '\u21C6',
        'leftrightharpoons': '\u21CB',
        'leftrightsquigarrow': '\u21AD',
        'LeftRightVector': '\u294E',
        'LeftTeeArrow': '\u21A4',
        'LeftTee': '\u22A3',
        'LeftTeeVector': '\u295A',
        'leftthreetimes': '\u22CB',
        'LeftTriangleBar': '\u29CF',
        'LeftTriangle': '\u22B2',
        'LeftTriangleEqual': '\u22B4',
        'LeftUpDownVector': '\u2951',
        'LeftUpTeeVector': '\u2960',
        'LeftUpVectorBar': '\u2958',
        'LeftUpVector': '\u21BF',
        'LeftVectorBar': '\u2952',
        'LeftVector': '\u21BC',
        'lEg': '\u2A8B',
        'leg': '\u22DA',
        'leq': '\u2264',
        'leqq': '\u2266',
        'leqslant': '\u2A7D',
        'lescc': '\u2AA8',
        'les': '\u2A7D',
        'lesdot': '\u2A7F',
        'lesdoto': '\u2A81',
        'lesdotor': '\u2A83',
        'lesg': '\u22DA\uFE00',
        'lesges': '\u2A93',
        'lessapprox': '\u2A85',
        'lessdot': '\u22D6',
        'lesseqgtr': '\u22DA',
        'lesseqqgtr': '\u2A8B',
        'LessEqualGreater': '\u22DA',
        'LessFullEqual': '\u2266',
        'LessGreater': '\u2276',
        'lessgtr': '\u2276',
        'LessLess': '\u2AA1',
        'lesssim': '\u2272',
        'LessSlantEqual': '\u2A7D',
        'LessTilde': '\u2272',
        'lfisht': '\u297C',
        'lfloor': '\u230A',
        'Lfr': '\uD835\uDD0F',
        'lfr': '\uD835\uDD29',
        'lg': '\u2276',
        'lgE': '\u2A91',
        'lHar': '\u2962',
        'lhard': '\u21BD',
        'lharu': '\u21BC',
        'lharul': '\u296A',
        'lhblk': '\u2584',
        'LJcy': '\u0409',
        'ljcy': '\u0459',
        'llarr': '\u21C7',
        'll': '\u226A',
        'Ll': '\u22D8',
        'llcorner': '\u231E',
        'Lleftarrow': '\u21DA',
        'llhard': '\u296B',
        'lltri': '\u25FA',
        'Lmidot': '\u013F',
        'lmidot': '\u0140',
        'lmoustache': '\u23B0',
        'lmoust': '\u23B0',
        'lnap': '\u2A89',
        'lnapprox': '\u2A89',
        'lne': '\u2A87',
        'lnE': '\u2268',
        'lneq': '\u2A87',
        'lneqq': '\u2268',
        'lnsim': '\u22E6',
        'loang': '\u27EC',
        'loarr': '\u21FD',
        'lobrk': '\u27E6',
        'longleftarrow': '\u27F5',
        'LongLeftArrow': '\u27F5',
        'Longleftarrow': '\u27F8',
        'longleftrightarrow': '\u27F7',
        'LongLeftRightArrow': '\u27F7',
        'Longleftrightarrow': '\u27FA',
        'longmapsto': '\u27FC',
        'longrightarrow': '\u27F6',
        'LongRightArrow': '\u27F6',
        'Longrightarrow': '\u27F9',
        'looparrowleft': '\u21AB',
        'looparrowright': '\u21AC',
        'lopar': '\u2985',
        'Lopf': '\uD835\uDD43',
        'lopf': '\uD835\uDD5D',
        'loplus': '\u2A2D',
        'lotimes': '\u2A34',
        'lowast': '\u2217',
        'lowbar': '_',
        'LowerLeftArrow': '\u2199',
        'LowerRightArrow': '\u2198',
        'loz': '\u25CA',
        'lozenge': '\u25CA',
        'lozf': '\u29EB',
        'lpar': '(',
        'lparlt': '\u2993',
        'lrarr': '\u21C6',
        'lrcorner': '\u231F',
        'lrhar': '\u21CB',
        'lrhard': '\u296D',
        'lrm': '\u200E',
        'lrtri': '\u22BF',
        'lsaquo': '\u2039',
        'lscr': '\uD835\uDCC1',
        'Lscr': '\u2112',
        'lsh': '\u21B0',
        'Lsh': '\u21B0',
        'lsim': '\u2272',
        'lsime': '\u2A8D',
        'lsimg': '\u2A8F',
        'lsqb': '[',
        'lsquo': '\u2018',
        'lsquor': '\u201A',
        'Lstrok': '\u0141',
        'lstrok': '\u0142',
        'ltcc': '\u2AA6',
        'ltcir': '\u2A79',
        'lt': '<',
        'LT': '<',
        'Lt': '\u226A',
        'ltdot': '\u22D6',
        'lthree': '\u22CB',
        'ltimes': '\u22C9',
        'ltlarr': '\u2976',
        'ltquest': '\u2A7B',
        'ltri': '\u25C3',
        'ltrie': '\u22B4',
        'ltrif': '\u25C2',
        'ltrPar': '\u2996',
        'lurdshar': '\u294A',
        'luruhar': '\u2966',
        'lvertneqq': '\u2268\uFE00',
        'lvnE': '\u2268\uFE00',
        'macr': '\xAF',
        'male': '\u2642',
        'malt': '\u2720',
        'maltese': '\u2720',
        'Map': '\u2905',
        'map': '\u21A6',
        'mapsto': '\u21A6',
        'mapstodown': '\u21A7',
        'mapstoleft': '\u21A4',
        'mapstoup': '\u21A5',
        'marker': '\u25AE',
        'mcomma': '\u2A29',
        'Mcy': '\u041C',
        'mcy': '\u043C',
        'mdash': '\u2014',
        'mDDot': '\u223A',
        'measuredangle': '\u2221',
        'MediumSpace': '\u205F',
        'Mellintrf': '\u2133',
        'Mfr': '\uD835\uDD10',
        'mfr': '\uD835\uDD2A',
        'mho': '\u2127',
        'micro': '\xB5',
        'midast': '*',
        'midcir': '\u2AF0',
        'mid': '\u2223',
        'middot': '\xB7',
        'minusb': '\u229F',
        'minus': '\u2212',
        'minusd': '\u2238',
        'minusdu': '\u2A2A',
        'MinusPlus': '\u2213',
        'mlcp': '\u2ADB',
        'mldr': '\u2026',
        'mnplus': '\u2213',
        'models': '\u22A7',
        'Mopf': '\uD835\uDD44',
        'mopf': '\uD835\uDD5E',
        'mp': '\u2213',
        'mscr': '\uD835\uDCC2',
        'Mscr': '\u2133',
        'mstpos': '\u223E',
        'Mu': '\u039C',
        'mu': '\u03BC',
        'multimap': '\u22B8',
        'mumap': '\u22B8',
        'nabla': '\u2207',
        'Nacute': '\u0143',
        'nacute': '\u0144',
        'nang': '\u2220\u20D2',
        'nap': '\u2249',
        'napE': '\u2A70\u0338',
        'napid': '\u224B\u0338',
        'napos': '\u0149',
        'napprox': '\u2249',
        'natural': '\u266E',
        'naturals': '\u2115',
        'natur': '\u266E',
        'nbsp': '\xA0',
        'nbump': '\u224E\u0338',
        'nbumpe': '\u224F\u0338',
        'ncap': '\u2A43',
        'Ncaron': '\u0147',
        'ncaron': '\u0148',
        'Ncedil': '\u0145',
        'ncedil': '\u0146',
        'ncong': '\u2247',
        'ncongdot': '\u2A6D\u0338',
        'ncup': '\u2A42',
        'Ncy': '\u041D',
        'ncy': '\u043D',
        'ndash': '\u2013',
        'nearhk': '\u2924',
        'nearr': '\u2197',
        'neArr': '\u21D7',
        'nearrow': '\u2197',
        'ne': '\u2260',
        'nedot': '\u2250\u0338',
        'NegativeMediumSpace': '\u200B',
        'NegativeThickSpace': '\u200B',
        'NegativeThinSpace': '\u200B',
        'NegativeVeryThinSpace': '\u200B',
        'nequiv': '\u2262',
        'nesear': '\u2928',
        'nesim': '\u2242\u0338',
        'NestedGreaterGreater': '\u226B',
        'NestedLessLess': '\u226A',
        'NewLine': '\n',
        'nexist': '\u2204',
        'nexists': '\u2204',
        'Nfr': '\uD835\uDD11',
        'nfr': '\uD835\uDD2B',
        'ngE': '\u2267\u0338',
        'nge': '\u2271',
        'ngeq': '\u2271',
        'ngeqq': '\u2267\u0338',
        'ngeqslant': '\u2A7E\u0338',
        'nges': '\u2A7E\u0338',
        'nGg': '\u22D9\u0338',
        'ngsim': '\u2275',
        'nGt': '\u226B\u20D2',
        'ngt': '\u226F',
        'ngtr': '\u226F',
        'nGtv': '\u226B\u0338',
        'nharr': '\u21AE',
        'nhArr': '\u21CE',
        'nhpar': '\u2AF2',
        'ni': '\u220B',
        'nis': '\u22FC',
        'nisd': '\u22FA',
        'niv': '\u220B',
        'NJcy': '\u040A',
        'njcy': '\u045A',
        'nlarr': '\u219A',
        'nlArr': '\u21CD',
        'nldr': '\u2025',
        'nlE': '\u2266\u0338',
        'nle': '\u2270',
        'nleftarrow': '\u219A',
        'nLeftarrow': '\u21CD',
        'nleftrightarrow': '\u21AE',
        'nLeftrightarrow': '\u21CE',
        'nleq': '\u2270',
        'nleqq': '\u2266\u0338',
        'nleqslant': '\u2A7D\u0338',
        'nles': '\u2A7D\u0338',
        'nless': '\u226E',
        'nLl': '\u22D8\u0338',
        'nlsim': '\u2274',
        'nLt': '\u226A\u20D2',
        'nlt': '\u226E',
        'nltri': '\u22EA',
        'nltrie': '\u22EC',
        'nLtv': '\u226A\u0338',
        'nmid': '\u2224',
        'NoBreak': '\u2060',
        'NonBreakingSpace': '\xA0',
        'nopf': '\uD835\uDD5F',
        'Nopf': '\u2115',
        'Not': '\u2AEC',
        'not': '\xAC',
        'NotCongruent': '\u2262',
        'NotCupCap': '\u226D',
        'NotDoubleVerticalBar': '\u2226',
        'NotElement': '\u2209',
        'NotEqual': '\u2260',
        'NotEqualTilde': '\u2242\u0338',
        'NotExists': '\u2204',
        'NotGreater': '\u226F',
        'NotGreaterEqual': '\u2271',
        'NotGreaterFullEqual': '\u2267\u0338',
        'NotGreaterGreater': '\u226B\u0338',
        'NotGreaterLess': '\u2279',
        'NotGreaterSlantEqual': '\u2A7E\u0338',
        'NotGreaterTilde': '\u2275',
        'NotHumpDownHump': '\u224E\u0338',
        'NotHumpEqual': '\u224F\u0338',
        'notin': '\u2209',
        'notindot': '\u22F5\u0338',
        'notinE': '\u22F9\u0338',
        'notinva': '\u2209',
        'notinvb': '\u22F7',
        'notinvc': '\u22F6',
        'NotLeftTriangleBar': '\u29CF\u0338',
        'NotLeftTriangle': '\u22EA',
        'NotLeftTriangleEqual': '\u22EC',
        'NotLess': '\u226E',
        'NotLessEqual': '\u2270',
        'NotLessGreater': '\u2278',
        'NotLessLess': '\u226A\u0338',
        'NotLessSlantEqual': '\u2A7D\u0338',
        'NotLessTilde': '\u2274',
        'NotNestedGreaterGreater': '\u2AA2\u0338',
        'NotNestedLessLess': '\u2AA1\u0338',
        'notni': '\u220C',
        'notniva': '\u220C',
        'notnivb': '\u22FE',
        'notnivc': '\u22FD',
        'NotPrecedes': '\u2280',
        'NotPrecedesEqual': '\u2AAF\u0338',
        'NotPrecedesSlantEqual': '\u22E0',
        'NotReverseElement': '\u220C',
        'NotRightTriangleBar': '\u29D0\u0338',
        'NotRightTriangle': '\u22EB',
        'NotRightTriangleEqual': '\u22ED',
        'NotSquareSubset': '\u228F\u0338',
        'NotSquareSubsetEqual': '\u22E2',
        'NotSquareSuperset': '\u2290\u0338',
        'NotSquareSupersetEqual': '\u22E3',
        'NotSubset': '\u2282\u20D2',
        'NotSubsetEqual': '\u2288',
        'NotSucceeds': '\u2281',
        'NotSucceedsEqual': '\u2AB0\u0338',
        'NotSucceedsSlantEqual': '\u22E1',
        'NotSucceedsTilde': '\u227F\u0338',
        'NotSuperset': '\u2283\u20D2',
        'NotSupersetEqual': '\u2289',
        'NotTilde': '\u2241',
        'NotTildeEqual': '\u2244',
        'NotTildeFullEqual': '\u2247',
        'NotTildeTilde': '\u2249',
        'NotVerticalBar': '\u2224',
        'nparallel': '\u2226',
        'npar': '\u2226',
        'nparsl': '\u2AFD\u20E5',
        'npart': '\u2202\u0338',
        'npolint': '\u2A14',
        'npr': '\u2280',
        'nprcue': '\u22E0',
        'nprec': '\u2280',
        'npreceq': '\u2AAF\u0338',
        'npre': '\u2AAF\u0338',
        'nrarrc': '\u2933\u0338',
        'nrarr': '\u219B',
        'nrArr': '\u21CF',
        'nrarrw': '\u219D\u0338',
        'nrightarrow': '\u219B',
        'nRightarrow': '\u21CF',
        'nrtri': '\u22EB',
        'nrtrie': '\u22ED',
        'nsc': '\u2281',
        'nsccue': '\u22E1',
        'nsce': '\u2AB0\u0338',
        'Nscr': '\uD835\uDCA9',
        'nscr': '\uD835\uDCC3',
        'nshortmid': '\u2224',
        'nshortparallel': '\u2226',
        'nsim': '\u2241',
        'nsime': '\u2244',
        'nsimeq': '\u2244',
        'nsmid': '\u2224',
        'nspar': '\u2226',
        'nsqsube': '\u22E2',
        'nsqsupe': '\u22E3',
        'nsub': '\u2284',
        'nsubE': '\u2AC5\u0338',
        'nsube': '\u2288',
        'nsubset': '\u2282\u20D2',
        'nsubseteq': '\u2288',
        'nsubseteqq': '\u2AC5\u0338',
        'nsucc': '\u2281',
        'nsucceq': '\u2AB0\u0338',
        'nsup': '\u2285',
        'nsupE': '\u2AC6\u0338',
        'nsupe': '\u2289',
        'nsupset': '\u2283\u20D2',
        'nsupseteq': '\u2289',
        'nsupseteqq': '\u2AC6\u0338',
        'ntgl': '\u2279',
        'Ntilde': '\xD1',
        'ntilde': '\xF1',
        'ntlg': '\u2278',
        'ntriangleleft': '\u22EA',
        'ntrianglelefteq': '\u22EC',
        'ntriangleright': '\u22EB',
        'ntrianglerighteq': '\u22ED',
        'Nu': '\u039D',
        'nu': '\u03BD',
        'num': '#',
        'numero': '\u2116',
        'numsp': '\u2007',
        'nvap': '\u224D\u20D2',
        'nvdash': '\u22AC',
        'nvDash': '\u22AD',
        'nVdash': '\u22AE',
        'nVDash': '\u22AF',
        'nvge': '\u2265\u20D2',
        'nvgt': '>\u20D2',
        'nvHarr': '\u2904',
        'nvinfin': '\u29DE',
        'nvlArr': '\u2902',
        'nvle': '\u2264\u20D2',
        'nvlt': '<\u20D2',
        'nvltrie': '\u22B4\u20D2',
        'nvrArr': '\u2903',
        'nvrtrie': '\u22B5\u20D2',
        'nvsim': '\u223C\u20D2',
        'nwarhk': '\u2923',
        'nwarr': '\u2196',
        'nwArr': '\u21D6',
        'nwarrow': '\u2196',
        'nwnear': '\u2927',
        'Oacute': '\xD3',
        'oacute': '\xF3',
        'oast': '\u229B',
        'Ocirc': '\xD4',
        'ocirc': '\xF4',
        'ocir': '\u229A',
        'Ocy': '\u041E',
        'ocy': '\u043E',
        'odash': '\u229D',
        'Odblac': '\u0150',
        'odblac': '\u0151',
        'odiv': '\u2A38',
        'odot': '\u2299',
        'odsold': '\u29BC',
        'OElig': '\u0152',
        'oelig': '\u0153',
        'ofcir': '\u29BF',
        'Ofr': '\uD835\uDD12',
        'ofr': '\uD835\uDD2C',
        'ogon': '\u02DB',
        'Ograve': '\xD2',
        'ograve': '\xF2',
        'ogt': '\u29C1',
        'ohbar': '\u29B5',
        'ohm': '\u03A9',
        'oint': '\u222E',
        'olarr': '\u21BA',
        'olcir': '\u29BE',
        'olcross': '\u29BB',
        'oline': '\u203E',
        'olt': '\u29C0',
        'Omacr': '\u014C',
        'omacr': '\u014D',
        'Omega': '\u03A9',
        'omega': '\u03C9',
        'Omicron': '\u039F',
        'omicron': '\u03BF',
        'omid': '\u29B6',
        'ominus': '\u2296',
        'Oopf': '\uD835\uDD46',
        'oopf': '\uD835\uDD60',
        'opar': '\u29B7',
        'OpenCurlyDoubleQuote': '\u201C',
        'OpenCurlyQuote': '\u2018',
        'operp': '\u29B9',
        'oplus': '\u2295',
        'orarr': '\u21BB',
        'Or': '\u2A54',
        'or': '\u2228',
        'ord': '\u2A5D',
        'order': '\u2134',
        'orderof': '\u2134',
        'ordf': '\xAA',
        'ordm': '\xBA',
        'origof': '\u22B6',
        'oror': '\u2A56',
        'orslope': '\u2A57',
        'orv': '\u2A5B',
        'oS': '\u24C8',
        'Oscr': '\uD835\uDCAA',
        'oscr': '\u2134',
        'Oslash': '\xD8',
        'oslash': '\xF8',
        'osol': '\u2298',
        'Otilde': '\xD5',
        'otilde': '\xF5',
        'otimesas': '\u2A36',
        'Otimes': '\u2A37',
        'otimes': '\u2297',
        'Ouml': '\xD6',
        'ouml': '\xF6',
        'ovbar': '\u233D',
        'OverBar': '\u203E',
        'OverBrace': '\u23DE',
        'OverBracket': '\u23B4',
        'OverParenthesis': '\u23DC',
        'para': '\xB6',
        'parallel': '\u2225',
        'par': '\u2225',
        'parsim': '\u2AF3',
        'parsl': '\u2AFD',
        'part': '\u2202',
        'PartialD': '\u2202',
        'Pcy': '\u041F',
        'pcy': '\u043F',
        'percnt': '%',
        'period': '.',
        'permil': '\u2030',
        'perp': '\u22A5',
        'pertenk': '\u2031',
        'Pfr': '\uD835\uDD13',
        'pfr': '\uD835\uDD2D',
        'Phi': '\u03A6',
        'phi': '\u03C6',
        'phiv': '\u03D5',
        'phmmat': '\u2133',
        'phone': '\u260E',
        'Pi': '\u03A0',
        'pi': '\u03C0',
        'pitchfork': '\u22D4',
        'piv': '\u03D6',
        'planck': '\u210F',
        'planckh': '\u210E',
        'plankv': '\u210F',
        'plusacir': '\u2A23',
        'plusb': '\u229E',
        'pluscir': '\u2A22',
        'plus': '+',
        'plusdo': '\u2214',
        'plusdu': '\u2A25',
        'pluse': '\u2A72',
        'PlusMinus': '\xB1',
        'plusmn': '\xB1',
        'plussim': '\u2A26',
        'plustwo': '\u2A27',
        'pm': '\xB1',
        'Poincareplane': '\u210C',
        'pointint': '\u2A15',
        'popf': '\uD835\uDD61',
        'Popf': '\u2119',
        'pound': '\xA3',
        'prap': '\u2AB7',
        'Pr': '\u2ABB',
        'pr': '\u227A',
        'prcue': '\u227C',
        'precapprox': '\u2AB7',
        'prec': '\u227A',
        'preccurlyeq': '\u227C',
        'Precedes': '\u227A',
        'PrecedesEqual': '\u2AAF',
        'PrecedesSlantEqual': '\u227C',
        'PrecedesTilde': '\u227E',
        'preceq': '\u2AAF',
        'precnapprox': '\u2AB9',
        'precneqq': '\u2AB5',
        'precnsim': '\u22E8',
        'pre': '\u2AAF',
        'prE': '\u2AB3',
        'precsim': '\u227E',
        'prime': '\u2032',
        'Prime': '\u2033',
        'primes': '\u2119',
        'prnap': '\u2AB9',
        'prnE': '\u2AB5',
        'prnsim': '\u22E8',
        'prod': '\u220F',
        'Product': '\u220F',
        'profalar': '\u232E',
        'profline': '\u2312',
        'profsurf': '\u2313',
        'prop': '\u221D',
        'Proportional': '\u221D',
        'Proportion': '\u2237',
        'propto': '\u221D',
        'prsim': '\u227E',
        'prurel': '\u22B0',
        'Pscr': '\uD835\uDCAB',
        'pscr': '\uD835\uDCC5',
        'Psi': '\u03A8',
        'psi': '\u03C8',
        'puncsp': '\u2008',
        'Qfr': '\uD835\uDD14',
        'qfr': '\uD835\uDD2E',
        'qint': '\u2A0C',
        'qopf': '\uD835\uDD62',
        'Qopf': '\u211A',
        'qprime': '\u2057',
        'Qscr': '\uD835\uDCAC',
        'qscr': '\uD835\uDCC6',
        'quaternions': '\u210D',
        'quatint': '\u2A16',
        'quest': '?',
        'questeq': '\u225F',
        'quot': '"',
        'QUOT': '"',
        'rAarr': '\u21DB',
        'race': '\u223D\u0331',
        'Racute': '\u0154',
        'racute': '\u0155',
        'radic': '\u221A',
        'raemptyv': '\u29B3',
        'rang': '\u27E9',
        'Rang': '\u27EB',
        'rangd': '\u2992',
        'range': '\u29A5',
        'rangle': '\u27E9',
        'raquo': '\xBB',
        'rarrap': '\u2975',
        'rarrb': '\u21E5',
        'rarrbfs': '\u2920',
        'rarrc': '\u2933',
        'rarr': '\u2192',
        'Rarr': '\u21A0',
        'rArr': '\u21D2',
        'rarrfs': '\u291E',
        'rarrhk': '\u21AA',
        'rarrlp': '\u21AC',
        'rarrpl': '\u2945',
        'rarrsim': '\u2974',
        'Rarrtl': '\u2916',
        'rarrtl': '\u21A3',
        'rarrw': '\u219D',
        'ratail': '\u291A',
        'rAtail': '\u291C',
        'ratio': '\u2236',
        'rationals': '\u211A',
        'rbarr': '\u290D',
        'rBarr': '\u290F',
        'RBarr': '\u2910',
        'rbbrk': '\u2773',
        'rbrace': '}',
        'rbrack': ']',
        'rbrke': '\u298C',
        'rbrksld': '\u298E',
        'rbrkslu': '\u2990',
        'Rcaron': '\u0158',
        'rcaron': '\u0159',
        'Rcedil': '\u0156',
        'rcedil': '\u0157',
        'rceil': '\u2309',
        'rcub': '}',
        'Rcy': '\u0420',
        'rcy': '\u0440',
        'rdca': '\u2937',
        'rdldhar': '\u2969',
        'rdquo': '\u201D',
        'rdquor': '\u201D',
        'rdsh': '\u21B3',
        'real': '\u211C',
        'realine': '\u211B',
        'realpart': '\u211C',
        'reals': '\u211D',
        'Re': '\u211C',
        'rect': '\u25AD',
        'reg': '\xAE',
        'REG': '\xAE',
        'ReverseElement': '\u220B',
        'ReverseEquilibrium': '\u21CB',
        'ReverseUpEquilibrium': '\u296F',
        'rfisht': '\u297D',
        'rfloor': '\u230B',
        'rfr': '\uD835\uDD2F',
        'Rfr': '\u211C',
        'rHar': '\u2964',
        'rhard': '\u21C1',
        'rharu': '\u21C0',
        'rharul': '\u296C',
        'Rho': '\u03A1',
        'rho': '\u03C1',
        'rhov': '\u03F1',
        'RightAngleBracket': '\u27E9',
        'RightArrowBar': '\u21E5',
        'rightarrow': '\u2192',
        'RightArrow': '\u2192',
        'Rightarrow': '\u21D2',
        'RightArrowLeftArrow': '\u21C4',
        'rightarrowtail': '\u21A3',
        'RightCeiling': '\u2309',
        'RightDoubleBracket': '\u27E7',
        'RightDownTeeVector': '\u295D',
        'RightDownVectorBar': '\u2955',
        'RightDownVector': '\u21C2',
        'RightFloor': '\u230B',
        'rightharpoondown': '\u21C1',
        'rightharpoonup': '\u21C0',
        'rightleftarrows': '\u21C4',
        'rightleftharpoons': '\u21CC',
        'rightrightarrows': '\u21C9',
        'rightsquigarrow': '\u219D',
        'RightTeeArrow': '\u21A6',
        'RightTee': '\u22A2',
        'RightTeeVector': '\u295B',
        'rightthreetimes': '\u22CC',
        'RightTriangleBar': '\u29D0',
        'RightTriangle': '\u22B3',
        'RightTriangleEqual': '\u22B5',
        'RightUpDownVector': '\u294F',
        'RightUpTeeVector': '\u295C',
        'RightUpVectorBar': '\u2954',
        'RightUpVector': '\u21BE',
        'RightVectorBar': '\u2953',
        'RightVector': '\u21C0',
        'ring': '\u02DA',
        'risingdotseq': '\u2253',
        'rlarr': '\u21C4',
        'rlhar': '\u21CC',
        'rlm': '\u200F',
        'rmoustache': '\u23B1',
        'rmoust': '\u23B1',
        'rnmid': '\u2AEE',
        'roang': '\u27ED',
        'roarr': '\u21FE',
        'robrk': '\u27E7',
        'ropar': '\u2986',
        'ropf': '\uD835\uDD63',
        'Ropf': '\u211D',
        'roplus': '\u2A2E',
        'rotimes': '\u2A35',
        'RoundImplies': '\u2970',
        'rpar': ')',
        'rpargt': '\u2994',
        'rppolint': '\u2A12',
        'rrarr': '\u21C9',
        'Rrightarrow': '\u21DB',
        'rsaquo': '\u203A',
        'rscr': '\uD835\uDCC7',
        'Rscr': '\u211B',
        'rsh': '\u21B1',
        'Rsh': '\u21B1',
        'rsqb': ']',
        'rsquo': '\u2019',
        'rsquor': '\u2019',
        'rthree': '\u22CC',
        'rtimes': '\u22CA',
        'rtri': '\u25B9',
        'rtrie': '\u22B5',
        'rtrif': '\u25B8',
        'rtriltri': '\u29CE',
        'RuleDelayed': '\u29F4',
        'ruluhar': '\u2968',
        'rx': '\u211E',
        'Sacute': '\u015A',
        'sacute': '\u015B',
        'sbquo': '\u201A',
        'scap': '\u2AB8',
        'Scaron': '\u0160',
        'scaron': '\u0161',
        'Sc': '\u2ABC',
        'sc': '\u227B',
        'sccue': '\u227D',
        'sce': '\u2AB0',
        'scE': '\u2AB4',
        'Scedil': '\u015E',
        'scedil': '\u015F',
        'Scirc': '\u015C',
        'scirc': '\u015D',
        'scnap': '\u2ABA',
        'scnE': '\u2AB6',
        'scnsim': '\u22E9',
        'scpolint': '\u2A13',
        'scsim': '\u227F',
        'Scy': '\u0421',
        'scy': '\u0441',
        'sdotb': '\u22A1',
        'sdot': '\u22C5',
        'sdote': '\u2A66',
        'searhk': '\u2925',
        'searr': '\u2198',
        'seArr': '\u21D8',
        'searrow': '\u2198',
        'sect': '\xA7',
        'semi': ';',
        'seswar': '\u2929',
        'setminus': '\u2216',
        'setmn': '\u2216',
        'sext': '\u2736',
        'Sfr': '\uD835\uDD16',
        'sfr': '\uD835\uDD30',
        'sfrown': '\u2322',
        'sharp': '\u266F',
        'SHCHcy': '\u0429',
        'shchcy': '\u0449',
        'SHcy': '\u0428',
        'shcy': '\u0448',
        'ShortDownArrow': '\u2193',
        'ShortLeftArrow': '\u2190',
        'shortmid': '\u2223',
        'shortparallel': '\u2225',
        'ShortRightArrow': '\u2192',
        'ShortUpArrow': '\u2191',
        'shy': '\xAD',
        'Sigma': '\u03A3',
        'sigma': '\u03C3',
        'sigmaf': '\u03C2',
        'sigmav': '\u03C2',
        'sim': '\u223C',
        'simdot': '\u2A6A',
        'sime': '\u2243',
        'simeq': '\u2243',
        'simg': '\u2A9E',
        'simgE': '\u2AA0',
        'siml': '\u2A9D',
        'simlE': '\u2A9F',
        'simne': '\u2246',
        'simplus': '\u2A24',
        'simrarr': '\u2972',
        'slarr': '\u2190',
        'SmallCircle': '\u2218',
        'smallsetminus': '\u2216',
        'smashp': '\u2A33',
        'smeparsl': '\u29E4',
        'smid': '\u2223',
        'smile': '\u2323',
        'smt': '\u2AAA',
        'smte': '\u2AAC',
        'smtes': '\u2AAC\uFE00',
        'SOFTcy': '\u042C',
        'softcy': '\u044C',
        'solbar': '\u233F',
        'solb': '\u29C4',
        'sol': '/',
        'Sopf': '\uD835\uDD4A',
        'sopf': '\uD835\uDD64',
        'spades': '\u2660',
        'spadesuit': '\u2660',
        'spar': '\u2225',
        'sqcap': '\u2293',
        'sqcaps': '\u2293\uFE00',
        'sqcup': '\u2294',
        'sqcups': '\u2294\uFE00',
        'Sqrt': '\u221A',
        'sqsub': '\u228F',
        'sqsube': '\u2291',
        'sqsubset': '\u228F',
        'sqsubseteq': '\u2291',
        'sqsup': '\u2290',
        'sqsupe': '\u2292',
        'sqsupset': '\u2290',
        'sqsupseteq': '\u2292',
        'square': '\u25A1',
        'Square': '\u25A1',
        'SquareIntersection': '\u2293',
        'SquareSubset': '\u228F',
        'SquareSubsetEqual': '\u2291',
        'SquareSuperset': '\u2290',
        'SquareSupersetEqual': '\u2292',
        'SquareUnion': '\u2294',
        'squarf': '\u25AA',
        'squ': '\u25A1',
        'squf': '\u25AA',
        'srarr': '\u2192',
        'Sscr': '\uD835\uDCAE',
        'sscr': '\uD835\uDCC8',
        'ssetmn': '\u2216',
        'ssmile': '\u2323',
        'sstarf': '\u22C6',
        'Star': '\u22C6',
        'star': '\u2606',
        'starf': '\u2605',
        'straightepsilon': '\u03F5',
        'straightphi': '\u03D5',
        'strns': '\xAF',
        'sub': '\u2282',
        'Sub': '\u22D0',
        'subdot': '\u2ABD',
        'subE': '\u2AC5',
        'sube': '\u2286',
        'subedot': '\u2AC3',
        'submult': '\u2AC1',
        'subnE': '\u2ACB',
        'subne': '\u228A',
        'subplus': '\u2ABF',
        'subrarr': '\u2979',
        'subset': '\u2282',
        'Subset': '\u22D0',
        'subseteq': '\u2286',
        'subseteqq': '\u2AC5',
        'SubsetEqual': '\u2286',
        'subsetneq': '\u228A',
        'subsetneqq': '\u2ACB',
        'subsim': '\u2AC7',
        'subsub': '\u2AD5',
        'subsup': '\u2AD3',
        'succapprox': '\u2AB8',
        'succ': '\u227B',
        'succcurlyeq': '\u227D',
        'Succeeds': '\u227B',
        'SucceedsEqual': '\u2AB0',
        'SucceedsSlantEqual': '\u227D',
        'SucceedsTilde': '\u227F',
        'succeq': '\u2AB0',
        'succnapprox': '\u2ABA',
        'succneqq': '\u2AB6',
        'succnsim': '\u22E9',
        'succsim': '\u227F',
        'SuchThat': '\u220B',
        'sum': '\u2211',
        'Sum': '\u2211',
        'sung': '\u266A',
        'sup1': '\xB9',
        'sup2': '\xB2',
        'sup3': '\xB3',
        'sup': '\u2283',
        'Sup': '\u22D1',
        'supdot': '\u2ABE',
        'supdsub': '\u2AD8',
        'supE': '\u2AC6',
        'supe': '\u2287',
        'supedot': '\u2AC4',
        'Superset': '\u2283',
        'SupersetEqual': '\u2287',
        'suphsol': '\u27C9',
        'suphsub': '\u2AD7',
        'suplarr': '\u297B',
        'supmult': '\u2AC2',
        'supnE': '\u2ACC',
        'supne': '\u228B',
        'supplus': '\u2AC0',
        'supset': '\u2283',
        'Supset': '\u22D1',
        'supseteq': '\u2287',
        'supseteqq': '\u2AC6',
        'supsetneq': '\u228B',
        'supsetneqq': '\u2ACC',
        'supsim': '\u2AC8',
        'supsub': '\u2AD4',
        'supsup': '\u2AD6',
        'swarhk': '\u2926',
        'swarr': '\u2199',
        'swArr': '\u21D9',
        'swarrow': '\u2199',
        'swnwar': '\u292A',
        'szlig': '\xDF',
        'Tab': '\t',
        'target': '\u2316',
        'Tau': '\u03A4',
        'tau': '\u03C4',
        'tbrk': '\u23B4',
        'Tcaron': '\u0164',
        'tcaron': '\u0165',
        'Tcedil': '\u0162',
        'tcedil': '\u0163',
        'Tcy': '\u0422',
        'tcy': '\u0442',
        'tdot': '\u20DB',
        'telrec': '\u2315',
        'Tfr': '\uD835\uDD17',
        'tfr': '\uD835\uDD31',
        'there4': '\u2234',
        'therefore': '\u2234',
        'Therefore': '\u2234',
        'Theta': '\u0398',
        'theta': '\u03B8',
        'thetasym': '\u03D1',
        'thetav': '\u03D1',
        'thickapprox': '\u2248',
        'thicksim': '\u223C',
        'ThickSpace': '\u205F\u200A',
        'ThinSpace': '\u2009',
        'thinsp': '\u2009',
        'thkap': '\u2248',
        'thksim': '\u223C',
        'THORN': '\xDE',
        'thorn': '\xFE',
        'tilde': '\u02DC',
        'Tilde': '\u223C',
        'TildeEqual': '\u2243',
        'TildeFullEqual': '\u2245',
        'TildeTilde': '\u2248',
        'timesbar': '\u2A31',
        'timesb': '\u22A0',
        'times': '\xD7',
        'timesd': '\u2A30',
        'tint': '\u222D',
        'toea': '\u2928',
        'topbot': '\u2336',
        'topcir': '\u2AF1',
        'top': '\u22A4',
        'Topf': '\uD835\uDD4B',
        'topf': '\uD835\uDD65',
        'topfork': '\u2ADA',
        'tosa': '\u2929',
        'tprime': '\u2034',
        'trade': '\u2122',
        'TRADE': '\u2122',
        'triangle': '\u25B5',
        'triangledown': '\u25BF',
        'triangleleft': '\u25C3',
        'trianglelefteq': '\u22B4',
        'triangleq': '\u225C',
        'triangleright': '\u25B9',
        'trianglerighteq': '\u22B5',
        'tridot': '\u25EC',
        'trie': '\u225C',
        'triminus': '\u2A3A',
        'TripleDot': '\u20DB',
        'triplus': '\u2A39',
        'trisb': '\u29CD',
        'tritime': '\u2A3B',
        'trpezium': '\u23E2',
        'Tscr': '\uD835\uDCAF',
        'tscr': '\uD835\uDCC9',
        'TScy': '\u0426',
        'tscy': '\u0446',
        'TSHcy': '\u040B',
        'tshcy': '\u045B',
        'Tstrok': '\u0166',
        'tstrok': '\u0167',
        'twixt': '\u226C',
        'twoheadleftarrow': '\u219E',
        'twoheadrightarrow': '\u21A0',
        'Uacute': '\xDA',
        'uacute': '\xFA',
        'uarr': '\u2191',
        'Uarr': '\u219F',
        'uArr': '\u21D1',
        'Uarrocir': '\u2949',
        'Ubrcy': '\u040E',
        'ubrcy': '\u045E',
        'Ubreve': '\u016C',
        'ubreve': '\u016D',
        'Ucirc': '\xDB',
        'ucirc': '\xFB',
        'Ucy': '\u0423',
        'ucy': '\u0443',
        'udarr': '\u21C5',
        'Udblac': '\u0170',
        'udblac': '\u0171',
        'udhar': '\u296E',
        'ufisht': '\u297E',
        'Ufr': '\uD835\uDD18',
        'ufr': '\uD835\uDD32',
        'Ugrave': '\xD9',
        'ugrave': '\xF9',
        'uHar': '\u2963',
        'uharl': '\u21BF',
        'uharr': '\u21BE',
        'uhblk': '\u2580',
        'ulcorn': '\u231C',
        'ulcorner': '\u231C',
        'ulcrop': '\u230F',
        'ultri': '\u25F8',
        'Umacr': '\u016A',
        'umacr': '\u016B',
        'uml': '\xA8',
        'UnderBar': '_',
        'UnderBrace': '\u23DF',
        'UnderBracket': '\u23B5',
        'UnderParenthesis': '\u23DD',
        'Union': '\u22C3',
        'UnionPlus': '\u228E',
        'Uogon': '\u0172',
        'uogon': '\u0173',
        'Uopf': '\uD835\uDD4C',
        'uopf': '\uD835\uDD66',
        'UpArrowBar': '\u2912',
        'uparrow': '\u2191',
        'UpArrow': '\u2191',
        'Uparrow': '\u21D1',
        'UpArrowDownArrow': '\u21C5',
        'updownarrow': '\u2195',
        'UpDownArrow': '\u2195',
        'Updownarrow': '\u21D5',
        'UpEquilibrium': '\u296E',
        'upharpoonleft': '\u21BF',
        'upharpoonright': '\u21BE',
        'uplus': '\u228E',
        'UpperLeftArrow': '\u2196',
        'UpperRightArrow': '\u2197',
        'upsi': '\u03C5',
        'Upsi': '\u03D2',
        'upsih': '\u03D2',
        'Upsilon': '\u03A5',
        'upsilon': '\u03C5',
        'UpTeeArrow': '\u21A5',
        'UpTee': '\u22A5',
        'upuparrows': '\u21C8',
        'urcorn': '\u231D',
        'urcorner': '\u231D',
        'urcrop': '\u230E',
        'Uring': '\u016E',
        'uring': '\u016F',
        'urtri': '\u25F9',
        'Uscr': '\uD835\uDCB0',
        'uscr': '\uD835\uDCCA',
        'utdot': '\u22F0',
        'Utilde': '\u0168',
        'utilde': '\u0169',
        'utri': '\u25B5',
        'utrif': '\u25B4',
        'uuarr': '\u21C8',
        'Uuml': '\xDC',
        'uuml': '\xFC',
        'uwangle': '\u29A7',
        'vangrt': '\u299C',
        'varepsilon': '\u03F5',
        'varkappa': '\u03F0',
        'varnothing': '\u2205',
        'varphi': '\u03D5',
        'varpi': '\u03D6',
        'varpropto': '\u221D',
        'varr': '\u2195',
        'vArr': '\u21D5',
        'varrho': '\u03F1',
        'varsigma': '\u03C2',
        'varsubsetneq': '\u228A\uFE00',
        'varsubsetneqq': '\u2ACB\uFE00',
        'varsupsetneq': '\u228B\uFE00',
        'varsupsetneqq': '\u2ACC\uFE00',
        'vartheta': '\u03D1',
        'vartriangleleft': '\u22B2',
        'vartriangleright': '\u22B3',
        'vBar': '\u2AE8',
        'Vbar': '\u2AEB',
        'vBarv': '\u2AE9',
        'Vcy': '\u0412',
        'vcy': '\u0432',
        'vdash': '\u22A2',
        'vDash': '\u22A8',
        'Vdash': '\u22A9',
        'VDash': '\u22AB',
        'Vdashl': '\u2AE6',
        'veebar': '\u22BB',
        'vee': '\u2228',
        'Vee': '\u22C1',
        'veeeq': '\u225A',
        'vellip': '\u22EE',
        'verbar': '|',
        'Verbar': '\u2016',
        'vert': '|',
        'Vert': '\u2016',
        'VerticalBar': '\u2223',
        'VerticalLine': '|',
        'VerticalSeparator': '\u2758',
        'VerticalTilde': '\u2240',
        'VeryThinSpace': '\u200A',
        'Vfr': '\uD835\uDD19',
        'vfr': '\uD835\uDD33',
        'vltri': '\u22B2',
        'vnsub': '\u2282\u20D2',
        'vnsup': '\u2283\u20D2',
        'Vopf': '\uD835\uDD4D',
        'vopf': '\uD835\uDD67',
        'vprop': '\u221D',
        'vrtri': '\u22B3',
        'Vscr': '\uD835\uDCB1',
        'vscr': '\uD835\uDCCB',
        'vsubnE': '\u2ACB\uFE00',
        'vsubne': '\u228A\uFE00',
        'vsupnE': '\u2ACC\uFE00',
        'vsupne': '\u228B\uFE00',
        'Vvdash': '\u22AA',
        'vzigzag': '\u299A',
        'Wcirc': '\u0174',
        'wcirc': '\u0175',
        'wedbar': '\u2A5F',
        'wedge': '\u2227',
        'Wedge': '\u22C0',
        'wedgeq': '\u2259',
        'weierp': '\u2118',
        'Wfr': '\uD835\uDD1A',
        'wfr': '\uD835\uDD34',
        'Wopf': '\uD835\uDD4E',
        'wopf': '\uD835\uDD68',
        'wp': '\u2118',
        'wr': '\u2240',
        'wreath': '\u2240',
        'Wscr': '\uD835\uDCB2',
        'wscr': '\uD835\uDCCC',
        'xcap': '\u22C2',
        'xcirc': '\u25EF',
        'xcup': '\u22C3',
        'xdtri': '\u25BD',
        'Xfr': '\uD835\uDD1B',
        'xfr': '\uD835\uDD35',
        'xharr': '\u27F7',
        'xhArr': '\u27FA',
        'Xi': '\u039E',
        'xi': '\u03BE',
        'xlarr': '\u27F5',
        'xlArr': '\u27F8',
        'xmap': '\u27FC',
        'xnis': '\u22FB',
        'xodot': '\u2A00',
        'Xopf': '\uD835\uDD4F',
        'xopf': '\uD835\uDD69',
        'xoplus': '\u2A01',
        'xotime': '\u2A02',
        'xrarr': '\u27F6',
        'xrArr': '\u27F9',
        'Xscr': '\uD835\uDCB3',
        'xscr': '\uD835\uDCCD',
        'xsqcup': '\u2A06',
        'xuplus': '\u2A04',
        'xutri': '\u25B3',
        'xvee': '\u22C1',
        'xwedge': '\u22C0',
        'Yacute': '\xDD',
        'yacute': '\xFD',
        'YAcy': '\u042F',
        'yacy': '\u044F',
        'Ycirc': '\u0176',
        'ycirc': '\u0177',
        'Ycy': '\u042B',
        'ycy': '\u044B',
        'yen': '\xA5',
        'Yfr': '\uD835\uDD1C',
        'yfr': '\uD835\uDD36',
        'YIcy': '\u0407',
        'yicy': '\u0457',
        'Yopf': '\uD835\uDD50',
        'yopf': '\uD835\uDD6A',
        'Yscr': '\uD835\uDCB4',
        'yscr': '\uD835\uDCCE',
        'YUcy': '\u042E',
        'yucy': '\u044E',
        'yuml': '\xFF',
        'Yuml': '\u0178',
        'Zacute': '\u0179',
        'zacute': '\u017A',
        'Zcaron': '\u017D',
        'zcaron': '\u017E',
        'Zcy': '\u0417',
        'zcy': '\u0437',
        'Zdot': '\u017B',
        'zdot': '\u017C',
        'zeetrf': '\u2128',
        'ZeroWidthSpace': '\u200B',
        'Zeta': '\u0396',
        'zeta': '\u03B6',
        'zfr': '\uD835\uDD37',
        'Zfr': '\u2128',
        'ZHcy': '\u0416',
        'zhcy': '\u0436',
        'zigrarr': '\u21DD',
        'zopf': '\uD835\uDD6B',
        'Zopf': '\u2124',
        'Zscr': '\uD835\uDCB5',
        'zscr': '\uD835\uDCCF',
        'zwj': '\u200D',
        'zwnj': '\u200C'
    };
    var decodeMapLegacy = {
        'Aacute': '\xC1',
        'aacute': '\xE1',
        'Acirc': '\xC2',
        'acirc': '\xE2',
        'acute': '\xB4',
        'AElig': '\xC6',
        'aelig': '\xE6',
        'Agrave': '\xC0',
        'agrave': '\xE0',
        'amp': '&',
        'AMP': '&',
        'Aring': '\xC5',
        'aring': '\xE5',
        'Atilde': '\xC3',
        'atilde': '\xE3',
        'Auml': '\xC4',
        'auml': '\xE4',
        'brvbar': '\xA6',
        'Ccedil': '\xC7',
        'ccedil': '\xE7',
        'cedil': '\xB8',
        'cent': '\xA2',
        'copy': '\xA9',
        'COPY': '\xA9',
        'curren': '\xA4',
        'deg': '\xB0',
        'divide': '\xF7',
        'Eacute': '\xC9',
        'eacute': '\xE9',
        'Ecirc': '\xCA',
        'ecirc': '\xEA',
        'Egrave': '\xC8',
        'egrave': '\xE8',
        'ETH': '\xD0',
        'eth': '\xF0',
        'Euml': '\xCB',
        'euml': '\xEB',
        'frac12': '\xBD',
        'frac14': '\xBC',
        'frac34': '\xBE',
        'gt': '>',
        'GT': '>',
        'Iacute': '\xCD',
        'iacute': '\xED',
        'Icirc': '\xCE',
        'icirc': '\xEE',
        'iexcl': '\xA1',
        'Igrave': '\xCC',
        'igrave': '\xEC',
        'iquest': '\xBF',
        'Iuml': '\xCF',
        'iuml': '\xEF',
        'laquo': '\xAB',
        'lt': '<',
        'LT': '<',
        'macr': '\xAF',
        'micro': '\xB5',
        'middot': '\xB7',
        'nbsp': '\xA0',
        'not': '\xAC',
        'Ntilde': '\xD1',
        'ntilde': '\xF1',
        'Oacute': '\xD3',
        'oacute': '\xF3',
        'Ocirc': '\xD4',
        'ocirc': '\xF4',
        'Ograve': '\xD2',
        'ograve': '\xF2',
        'ordf': '\xAA',
        'ordm': '\xBA',
        'Oslash': '\xD8',
        'oslash': '\xF8',
        'Otilde': '\xD5',
        'otilde': '\xF5',
        'Ouml': '\xD6',
        'ouml': '\xF6',
        'para': '\xB6',
        'plusmn': '\xB1',
        'pound': '\xA3',
        'quot': '"',
        'QUOT': '"',
        'raquo': '\xBB',
        'reg': '\xAE',
        'REG': '\xAE',
        'sect': '\xA7',
        'shy': '\xAD',
        'sup1': '\xB9',
        'sup2': '\xB2',
        'sup3': '\xB3',
        'szlig': '\xDF',
        'THORN': '\xDE',
        'thorn': '\xFE',
        'times': '\xD7',
        'Uacute': '\xDA',
        'uacute': '\xFA',
        'Ucirc': '\xDB',
        'ucirc': '\xFB',
        'Ugrave': '\xD9',
        'ugrave': '\xF9',
        'uml': '\xA8',
        'Uuml': '\xDC',
        'uuml': '\xFC',
        'Yacute': '\xDD',
        'yacute': '\xFD',
        'yen': '\xA5',
        'yuml': '\xFF'
    };
    var decodeMapNumeric = {
        '0': '\uFFFD',
        '128': '\u20AC',
        '130': '\u201A',
        '131': '\u0192',
        '132': '\u201E',
        '133': '\u2026',
        '134': '\u2020',
        '135': '\u2021',
        '136': '\u02C6',
        '137': '\u2030',
        '138': '\u0160',
        '139': '\u2039',
        '140': '\u0152',
        '142': '\u017D',
        '145': '\u2018',
        '146': '\u2019',
        '147': '\u201C',
        '148': '\u201D',
        '149': '\u2022',
        '150': '\u2013',
        '151': '\u2014',
        '152': '\u02DC',
        '153': '\u2122',
        '154': '\u0161',
        '155': '\u203A',
        '156': '\u0153',
        '158': '\u017E',
        '159': '\u0178'
    };
    var invalidReferenceCodePoints = [1, 2, 3, 4, 5, 6, 7, 8, 11, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 64976, 64977, 64978, 64979, 64980, 64981, 64982, 64983, 64984, 64985, 64986, 64987, 64988, 64989, 64990, 64991, 64992, 64993, 64994, 64995, 64996, 64997, 64998, 64999, 65000, 65001, 65002, 65003, 65004, 65005, 65006, 65007, 65534, 65535, 131070, 131071, 196606, 196607, 262142, 262143, 327678, 327679, 393214, 393215, 458750, 458751, 524286, 524287, 589822, 589823, 655358, 655359, 720894, 720895, 786430, 786431, 851966, 851967, 917502, 917503, 983038, 983039, 1048574, 1048575, 1114110, 1114111];

    /*--------------------------------------------------------------------------*/

    var stringFromCharCode = String.fromCharCode;

    var object = {};
    var hasOwnProperty = object.hasOwnProperty;
    var has = function (object, propertyName) {
        return hasOwnProperty.call(object, propertyName);
    };

    var contains = function (array, value) {
        var index = -1;
        var length = array.length;
        while (++index < length) {
            if (array[index] == value) {
                return true;
            }
        }
        return false;
    };

    var merge = function (options, defaults) {
        if (!options) {
            return defaults;
        }
        var result = {};
        var key;
        for (key in defaults) {
            // A `hasOwnProperty` check is not needed here, since only recognized
            // option names are used anyway. Any others are ignored.
            result[key] = has(options, key) ? options[key] : defaults[key];
        }
        return result;
    };

    // Modified version of `ucs2encode`; see https://mths.be/punycode.
    var codePointToSymbol = function (codePoint, strict) {
        var output = '';
        if ((codePoint >= 0xD800 && codePoint <= 0xDFFF) || codePoint > 0x10FFFF) {
            // See issue #4:
            // “Otherwise, if the number is in the range 0xD800 to 0xDFFF or is
            // greater than 0x10FFFF, then this is a parse error. Return a U+FFFD
            // REPLACEMENT CHARACTER.”
            if (strict) {
                parseError('character reference outside the permissible Unicode range');
            }
            return '\uFFFD';
        }
        if (has(decodeMapNumeric, codePoint)) {
            if (strict) {
                parseError('disallowed character reference');
            }
            return decodeMapNumeric[codePoint];
        }
        if (strict && contains(invalidReferenceCodePoints, codePoint)) {
            parseError('disallowed character reference');
        }
        if (codePoint > 0xFFFF) {
            codePoint -= 0x10000;
            output += stringFromCharCode(codePoint >>> 10 & 0x3FF | 0xD800);
            codePoint = 0xDC00 | codePoint & 0x3FF;
        }
        output += stringFromCharCode(codePoint);
        return output;
    };

    var hexEscape = function (symbol) {
        return '&#x' + symbol.charCodeAt(0).toString(16).toUpperCase() + ';';
    };

    var parseError = function (message) {
        throw Error('Parse error: ' + message);
    };

    /*--------------------------------------------------------------------------*/

    var encode = function (string, options) {
        options = merge(options, encode.options);
        var strict = options.strict;
        if (strict && regexInvalidRawCodePoint.test(string)) {
            parseError('forbidden code point');
        }
        var encodeEverything = options.encodeEverything;
        var useNamedReferences = options.useNamedReferences;
        var allowUnsafeSymbols = options.allowUnsafeSymbols;
        if (encodeEverything) {
            // Encode ASCII symbols.
            string = string.replace(regexAsciiWhitelist, function (symbol) {
                // Use named references if requested & possible.
                if (useNamedReferences && has(encodeMap, symbol)) {
                    return '&' + encodeMap[symbol] + ';';
                }
                return hexEscape(symbol);
            });
            // Shorten a few escapes that represent two symbols, of which at least one
            // is within the ASCII range.
            if (useNamedReferences) {
                string = string
                    .replace(/&gt;\u20D2/g, '&nvgt;')
                    .replace(/&lt;\u20D2/g, '&nvlt;')
                    .replace(/&#x66;&#x6A;/g, '&fjlig;');
            }
            // Encode non-ASCII symbols.
            if (useNamedReferences) {
                // Encode non-ASCII symbols that can be replaced with a named reference.
                string = string.replace(regexEncodeNonAscii, function (string) {
                    // Note: there is no need to check `has(encodeMap, string)` here.
                    return '&' + encodeMap[string] + ';';
                });
            }
            // Note: any remaining non-ASCII symbols are handled outside of the `if`.
        } else if (useNamedReferences) {
            // Apply named character references.
            // Encode `<>"'&` using named character references.
            if (!allowUnsafeSymbols) {
                string = string.replace(regexEscape, function (string) {
                    return '&' + encodeMap[string] + ';'; // no need to check `has()` here
                });
            }
            // Shorten escapes that represent two symbols, of which at least one is
            // `<>"'&`.
            string = string
                .replace(/&gt;\u20D2/g, '&nvgt;')
                .replace(/&lt;\u20D2/g, '&nvlt;');
            // Encode non-ASCII symbols that can be replaced with a named reference.
            string = string.replace(regexEncodeNonAscii, function (string) {
                // Note: there is no need to check `has(encodeMap, string)` here.
                return '&' + encodeMap[string] + ';';
            });
        } else if (!allowUnsafeSymbols) {
            // Encode `<>"'&` using hexadecimal escapes, now that they’re not handled
            // using named character references.
            string = string.replace(regexEscape, hexEscape);
        }
        return string
            // Encode astral symbols.
            .replace(regexAstralSymbols, function ($0) {
                // https://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
                var high = $0.charCodeAt(0);
                var low = $0.charCodeAt(1);
                var codePoint = (high - 0xD800) * 0x400 + low - 0xDC00 + 0x10000;
                return '&#x' + codePoint.toString(16).toUpperCase() + ';';
            })
            // Encode any remaining BMP symbols that are not printable ASCII symbols
            // using a hexadecimal escape.
            .replace(regexBmpWhitelist, hexEscape);
    };
    // Expose default options (so they can be overridden globally).
    encode.options = {
        'allowUnsafeSymbols': false,
        'encodeEverything': false,
        'strict': false,
        'useNamedReferences': false
    };

    var decode = function (html, options) {
        options = merge(options, decode.options);
        var strict = options.strict;
        if (strict && regexInvalidEntity.test(html)) {
            parseError('malformed character reference');
        }
        return html.replace(regexDecode, function ($0, $1, $2, $3, $4, $5, $6, $7) {
            var codePoint;
            var semicolon;
            var hexDigits;
            var reference;
            var next;
            if ($1) {
                // Decode decimal escapes, e.g. `&#119558;`.
                codePoint = $1;
                semicolon = $2;
                if (strict && !semicolon) {
                    parseError('character reference was not terminated by a semicolon');
                }
                return codePointToSymbol(codePoint, strict);
            }
            if ($3) {
                // Decode hexadecimal escapes, e.g. `&#x1D306;`.
                hexDigits = $3;
                semicolon = $4;
                if (strict && !semicolon) {
                    parseError('character reference was not terminated by a semicolon');
                }
                codePoint = parseInt(hexDigits, 16);
                return codePointToSymbol(codePoint, strict);
            }
            if ($5) {
                // Decode named character references with trailing `;`, e.g. `&copy;`.
                reference = $5;
                if (has(decodeMap, reference)) {
                    return decodeMap[reference];
                } else {
                    // Ambiguous ampersand. https://mths.be/notes/ambiguous-ampersands
                    if (strict) {
                        parseError(
                            'named character reference was not terminated by a semicolon'
                        );
                    }
                    return $0;
                }
            }
            // If we’re still here, it’s a legacy reference for sure. No need for an
            // extra `if` check.
            // Decode named character references without trailing `;`, e.g. `&amp`
            // This is only a parse error if it gets converted to `&`, or if it is
            // followed by `=` in an attribute context.
            reference = $6;
            next = $7;
            if (next && options.isAttributeValue) {
                if (strict && next == '=') {
                    parseError('`&` did not start a character reference');
                }
                return $0;
            } else {
                if (strict) {
                    parseError(
                        'named character reference was not terminated by a semicolon'
                    );
                }
                // Note: there is no need to check `has(decodeMapLegacy, reference)`.
                return decodeMapLegacy[reference] + (next || '');
            }
        });
    };
    // Expose default options (so they can be overridden globally).
    decode.options = {
        'isAttributeValue': false,
        'strict': false
    };

    var escape = function (string) {
        return string.replace(regexEscape, function ($0) {
            // Note: there is no need to check `has(escapeMap, $0)` here.
            return escapeMap[$0];
        });
    };

    /*--------------------------------------------------------------------------*/

    var he = {
        'version': '0.5.0',
        'encode': encode,
        'decode': decode,
        'escape': escape,
        'unescape': decode
    };

    // Some AMD build optimizers, like r.js, check for specific condition patterns
    // like the following:
    if (
        typeof define == 'function' &&
        typeof define.amd == 'object' &&
        define.amd
    ) {
        define(function () {
            return he;
        });
    } else if (freeExports && !freeExports.nodeType) {
        if (freeModule) { // in Node.js, io.js, or RingoJS v0.8.0+
            freeModule.exports = he;
        } else { // in Narwhal or RingoJS v0.7.0-
            for (var key in he) {
                has(he, key) && (freeExports[key] = he[key]);
            }
        }
    } else { // in Rhino or a web browser
        root.he = he;
    }

}(this));

// Source: public/javascripts/vendor/markdown/marked.js
/**
 * marked - a markdown parser
 * Copyright (c) 2011-2014, Christopher Jeffrey. (MIT Licensed)
 * https://github.com/chjj/marked
 */

(function () {

    /**
     * Block-Level Grammar
     */

    var block = {
        newline: /^\n+/,
        code: /^( {4}[^\n]+\n*)+/,
        fences: noop,
        hr: /^( *[-*_]){3,} *(?:\n+|$)/,
        heading: /^ *(#{1,6}) *([^\n]+?) *#* *(?:\n+|$)/,
        nptable: noop,
        lheading: /^([^\n]+)\n *(=|-){2,} *(?:\n+|$)/,
        blockquote: /^( *>[^\n]+(\n(?!def)[^\n]+)*\n*)+/,
        list: /^( *)(bull) [\s\S]+?(?:hr|def|\n{2,}(?! )(?!\1bull )\n*|\s*$)/,
        html: /^ *(?:comment *(?:\n|\s*$)|closed *(?:\n{2,}|\s*$)|closing *(?:\n{2,}|\s*$))/,
        def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +["(]([^\n]+)[")])? *(?:\n+|$)/,
        table: noop,
        paragraph: /^((?:[^\n]+\n?(?!hr|heading|lheading|blockquote|tag|def))+)\n*/,
        text: /^[^\n]+/
    };

    block.bullet = /(?:[*+-]|\d+\.)/;
    block.item = /^( *)(bull) [^\n]*(?:\n(?!\1bull )[^\n]*)*/;
    block.item = replace(block.item, 'gm')(/bull/g, block.bullet)();

    block.list = replace(block.list)(/bull/g, block.bullet)('hr', '\\n+(?=\\1?(?:[-*_] *){3,}(?:\\n+|$))')('def', '\\n+(?=' + block.def.source + ')')();

    block.blockquote = replace(block.blockquote)
    ('def', block.def)
    ();

    block._tag = '(?!(?:'
    + 'a|em|strong|small|s|cite|q|dfn|abbr|data|time|code'
    + '|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo'
    + '|span|br|wbr|ins|del|img)\\b)\\w+(?!:/|[^\\w\\s@]*@)\\b';

    block.html = replace(block.html)
    ('comment', /<!--[\s\S]*?-->/)
    ('closed', /<(tag)[\s\S]+?<\/\1>/)
    ('closing', /<tag(?:"[^"]*"|'[^']*'|[^'">])*?>/)
    (/tag/g, block._tag)
    ();

    block.paragraph = replace(block.paragraph)
    ('hr', block.hr)
    ('heading', block.heading)
    ('lheading', block.lheading)
    ('blockquote', block.blockquote)
    ('tag', '<' + block._tag)
    ('def', block.def)
    ();

    /**
     * Normal Block Grammar
     */

    block.normal = merge({}, block);

    /**
     * GFM Block Grammar
     */

    block.gfm = merge({}, block.normal, {
        fences: /^ *(`{3,}|~{3,}) *(\S+)? *\n([\s\S]+?)\s*\1 *(?:\n+|$)/,
        paragraph: /^/
    });

    block.gfm.paragraph = replace(block.paragraph)
    ('(?!', '(?!'
    + block.gfm.fences.source.replace('\\1', '\\2') + '|'
    + block.list.source.replace('\\1', '\\3') + '|')
    ();

    /**
     * GFM + Tables Block Grammar
     */

    block.tables = merge({}, block.gfm, {
        nptable: /^ *(\S.*\|.*)\n *([-:]+ *\|[-| :]*)\n((?:.*\|.*(?:\n|$))*)\n*/,
        table: /^ *\|(.+)\n *\|( *[-:]+[-| :]*)\n((?: *\|.*(?:\n|$))*)\n*/
    });

    /**
     * Block Lexer
     */

    function Lexer(options) {
        this.tokens = [];
        this.tokens.links = {};
        this.options = options || marked.defaults;
        this.rules = block.normal;

        if (this.options.gfm) {
            if (this.options.tables) {
                this.rules = block.tables;
            } else {
                this.rules = block.gfm;
            }
        }
    }

    /**
     * Expose Block Rules
     */

    Lexer.rules = block;

    /**
     * Static Lex Method
     */

    Lexer.lex = function (src, options) {
        var lexer = new Lexer(options);
        return lexer.lex(src);
    };

    /**
     * Preprocessing
     */

    Lexer.prototype.lex = function (src) {
        src = src
            .replace(/\r\n|\r/g, '\n')
            .replace(/\t/g, '    ')
            .replace(/\u00a0/g, ' ')
            .replace(/\u2424/g, '\n');

        return this.token(src, true);
    };

    /**
     * Lexing
     */

    Lexer.prototype.token = function (src, top, bq) {
        var src = src.replace(/^ +$/gm, '')
            , next
            , loose
            , cap
            , bull
            , b
            , item
            , space
            , i
            , l;

        while (src) {
            // newline
            if (cap = this.rules.newline.exec(src)) {
                src = src.substring(cap[0].length);
                if (cap[0].length > 1) {
                    this.tokens.push({
                        type: 'space'
                    });
                }
            }

            // code
            if (cap = this.rules.code.exec(src)) {
                src = src.substring(cap[0].length);
                cap = cap[0].replace(/^ {4}/gm, '');
                this.tokens.push({
                    type: 'code',
                    text: !this.options.pedantic
                        ? cap.replace(/\n+$/, '')
                        : cap
                });
                continue;
            }

            // fences (gfm)
            if (cap = this.rules.fences.exec(src)) {
                src = src.substring(cap[0].length);
                this.tokens.push({
                    type: 'code',
                    lang: cap[2],
                    text: cap[3]
                });
                continue;
            }

            // heading
            if (cap = this.rules.heading.exec(src)) {
                src = src.substring(cap[0].length);
                this.tokens.push({
                    type: 'heading',
                    depth: cap[1].length,
                    text: cap[2]
                });
                continue;
            }

            // table no leading pipe (gfm)
            if (top && (cap = this.rules.nptable.exec(src))) {
                src = src.substring(cap[0].length);

                item = {
                    type: 'table',
                    header: cap[1].replace(/^ *| *\| *$/g, '').split(/ *\| */),
                    align: cap[2].replace(/^ *|\| *$/g, '').split(/ *\| */),
                    cells: cap[3].replace(/\n$/, '').split('\n')
                };

                for (i = 0; i < item.align.length; i++) {
                    if (/^ *-+: *$/.test(item.align[i])) {
                        item.align[i] = 'right';
                    } else if (/^ *:-+: *$/.test(item.align[i])) {
                        item.align[i] = 'center';
                    } else if (/^ *:-+ *$/.test(item.align[i])) {
                        item.align[i] = 'left';
                    } else {
                        item.align[i] = null;
                    }
                }

                for (i = 0; i < item.cells.length; i++) {
                    item.cells[i] = item.cells[i].split(/ *\| */);
                }

                this.tokens.push(item);

                continue;
            }

            // lheading
            if (cap = this.rules.lheading.exec(src)) {
                src = src.substring(cap[0].length);
                this.tokens.push({
                    type: 'heading',
                    depth: cap[2] === '=' ? 1 : 2,
                    text: cap[1]
                });
                continue;
            }

            // hr
            if (cap = this.rules.hr.exec(src)) {
                src = src.substring(cap[0].length);
                this.tokens.push({
                    type: 'hr'
                });
                continue;
            }

            // blockquote
            if (cap = this.rules.blockquote.exec(src)) {
                src = src.substring(cap[0].length);

                this.tokens.push({
                    type: 'blockquote_start'
                });

                cap = cap[0].replace(/^ *> ?/gm, '');

                // Pass `top` to keep the current
                // "toplevel" state. This is exactly
                // how markdown.pl works.
                this.token(cap, top, true);

                this.tokens.push({
                    type: 'blockquote_end'
                });

                continue;
            }

            // list
            if (cap = this.rules.list.exec(src)) {
                src = src.substring(cap[0].length);
                bull = cap[2];

                this.tokens.push({
                    type: 'list_start',
                    ordered: bull.length > 1
                });

                // Get each top-level item.
                cap = cap[0].match(this.rules.item);

                next = false;
                l = cap.length;
                i = 0;

                for (; i < l; i++) {
                    item = cap[i];

                    // Remove the list item's bullet
                    // so it is seen as the next token.
                    space = item.length;
                    item = item.replace(/^ *([*+-]|\d+\.) +/, '');

                    // Outdent whatever the
                    // list item contains. Hacky.
                    if (~item.indexOf('\n ')) {
                        space -= item.length;
                        item = !this.options.pedantic
                            ? item.replace(new RegExp('^ {1,' + space + '}', 'gm'), '')
                            : item.replace(/^ {1,4}/gm, '');
                    }

                    // Determine whether the next list item belongs here.
                    // Backpedal if it does not belong in this list.
                    if (this.options.smartLists && i !== l - 1) {
                        b = block.bullet.exec(cap[i + 1])[0];
                        if (bull !== b && !(bull.length > 1 && b.length > 1)) {
                            src = cap.slice(i + 1).join('\n') + src;
                            i = l - 1;
                        }
                    }

                    // Determine whether item is loose or not.
                    // Use: /(^|\n)(?! )[^\n]+\n\n(?!\s*$)/
                    // for discount behavior.
                    loose = next || /\n\n(?!\s*$)/.test(item);
                    if (i !== l - 1) {
                        next = item.charAt(item.length - 1) === '\n';
                        if (!loose) loose = next;
                    }

                    this.tokens.push({
                        type: loose
                            ? 'loose_item_start'
                            : 'list_item_start'
                    });

                    // Recurse.
                    this.token(item, false, bq);

                    this.tokens.push({
                        type: 'list_item_end'
                    });
                }

                this.tokens.push({
                    type: 'list_end'
                });

                continue;
            }

            // html
            if (cap = this.rules.html.exec(src)) {
                src = src.substring(cap[0].length);
                this.tokens.push({
                    type: this.options.sanitize
                        ? 'paragraph'
                        : 'html',
                    pre: cap[1] === 'pre' || cap[1] === 'script' || cap[1] === 'style',
                    text: cap[0]
                });
                continue;
            }

            // def
            if ((!bq && top) && (cap = this.rules.def.exec(src))) {
                src = src.substring(cap[0].length);
                this.tokens.links[cap[1].toLowerCase()] = {
                    href: cap[2],
                    title: cap[3]
                };
                continue;
            }

            // table (gfm)
            if (top && (cap = this.rules.table.exec(src))) {
                src = src.substring(cap[0].length);

                item = {
                    type: 'table',
                    header: cap[1].replace(/^ *| *\| *$/g, '').split(/ *\| */),
                    align: cap[2].replace(/^ *|\| *$/g, '').split(/ *\| */),
                    cells: cap[3].replace(/(?: *\| *)?\n$/, '').split('\n')
                };

                for (i = 0; i < item.align.length; i++) {
                    if (/^ *-+: *$/.test(item.align[i])) {
                        item.align[i] = 'right';
                    } else if (/^ *:-+: *$/.test(item.align[i])) {
                        item.align[i] = 'center';
                    } else if (/^ *:-+ *$/.test(item.align[i])) {
                        item.align[i] = 'left';
                    } else {
                        item.align[i] = null;
                    }
                }

                for (i = 0; i < item.cells.length; i++) {
                    item.cells[i] = item.cells[i]
                        .replace(/^ *\| *| *\| *$/g, '')
                        .split(/ *\| */);
                }

                this.tokens.push(item);

                continue;
            }

            // top-level paragraph
            if (top && (cap = this.rules.paragraph.exec(src))) {
                src = src.substring(cap[0].length);
                this.tokens.push({
                    type: 'paragraph',
                    text: cap[1].charAt(cap[1].length - 1) === '\n'
                        ? cap[1].slice(0, -1)
                        : cap[1]
                });
                continue;
            }

            // text
            if (cap = this.rules.text.exec(src)) {
                // Top-level should never reach here.
                src = src.substring(cap[0].length);
                this.tokens.push({
                    type: 'text',
                    text: cap[0]
                });
                continue;
            }

            if (src) {
                throw new
                    Error('Infinite loop on byte: ' + src.charCodeAt(0));
            }
        }

        return this.tokens;
    };

    /**
     * Inline-Level Grammar
     */

    var inline = {
        escape: /^\\([\\`*{}\[\]()#+\-.!_>])/,
        autolink: /^<([^ >]+(@|:\/)[^ >]+)>/,
        url: noop,
        tag: /^<!--[\s\S]*?-->|^<\/?\w+(?:"[^"]*"|'[^']*'|[^'">])*?>/,
        link: /^!?\[(inside)\]\(href\)/,
        reflink: /^!?\[(inside)\]\s*\[([^\]]*)\]/,
        nolink: /^!?\[((?:\[[^\]]*\]|[^\[\]])*)\]/,
        strong: /^__([\s\S]+?)__(?!_)|^\*\*([\s\S]+?)\*\*(?!\*)/,
        em: /^\b_((?:__|[\s\S])+?)_\b|^\*((?:\*\*|[\s\S])+?)\*(?!\*)/,
        code: /^(`+)\s*([\s\S]*?[^`])\s*\1(?!`)/,
        br: /^ {2,}\n(?!\s*$)/,
        del: noop,
        emoji: noop,
        text: /^[\s\S]+?(?=[\\<!\[_*`]| {2,}\n|$)/
    };

    inline._inside = /(?:\[[^\]]*\]|[^\[\]]|\](?=[^\[]*\]))*/;
    inline._href = /\s*<?([\s\S]*?)>?(?:\s+['"]([\s\S]*?)['"])?\s*/;

    inline.link = replace(inline.link)
    ('inside', inline._inside)
    ('href', inline._href)
    ();

    inline.reflink = replace(inline.reflink)
    ('inside', inline._inside)
    ();

    /**
     * Normal Inline Grammar
     */

    inline.normal = merge({}, inline);

    /**
     * Pedantic Inline Grammar
     */

    inline.pedantic = merge({}, inline.normal, {
        strong: /^__(?=\S)([\s\S]*?\S)__(?!_)|^\*\*(?=\S)([\s\S]*?\S)\*\*(?!\*)/,
        em: /^_(?=\S)([\s\S]*?\S)_(?!_)|^\*(?=\S)([\s\S]*?\S)\*(?!\*)/
    });

    /**
     * GFM Inline Grammar
     */

    inline.gfm = merge({}, inline.normal, {
        escape: replace(inline.escape)('])', '~|])')(),
        url: /^(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/,
        del: /^~~(?=\S)([\s\S]*?\S)~~/,
        //emoji
        emoji: /^:([A-Za-z0-9_\-\+]+?):/,
        text: replace(inline.text)
            //(']|', '~]|')
        (']|', ':~]|')
        ('|', '|https?://|')
        ()
    });

    /**
     * GFM + Line Breaks Inline Grammar
     */

    inline.breaks = merge({}, inline.gfm, {
        br: replace(inline.br)('{2,}', '*')(),
        text: replace(inline.gfm.text)('{2,}', '*')()
    });

    /**
     * Inline Lexer & Compiler
     */

    function InlineLexer(links, options) {
        this.options = options || marked.defaults;
        this.links = links;
        this.rules = inline.normal;
        this.renderer = this.options.renderer || new Renderer;
        this.renderer.options = this.options;

        if (!this.links) {
            throw new
                Error('Tokens array requires a `links` property.');
        }

        if (this.options.gfm) {
            if (this.options.breaks) {
                this.rules = inline.breaks;
            } else {
                this.rules = inline.gfm;
            }
        } else if (this.options.pedantic) {
            this.rules = inline.pedantic;
        }
        //emoji
        this.emojiTemplate = getEmojiTemplate(options);
    }

    /**
     * Expose Inline Rules
     */

    InlineLexer.rules = inline;

    /**
     * Static Lexing/Compiling Method
     */

    InlineLexer.output = function (src, links, options) {
        var inline = new InlineLexer(links, options);
        return inline.output(src);
    };

    /**
     * Lexing/Compiling
     */

    InlineLexer.prototype.output = function (src) {
        var out = ''
            , link
            , text
            , href
            , cap;

        while (src) {
            // escape
            if (cap = this.rules.escape.exec(src)) {
                src = src.substring(cap[0].length);
                out += cap[1];
                continue;
            }

            // autolink
            if (cap = this.rules.autolink.exec(src)) {
                src = src.substring(cap[0].length);
                if (cap[2] === '@') {
                    text = cap[1].charAt(6) === ':'
                        ? this.mangle(cap[1].substring(7))
                        : this.mangle(cap[1]);
                    href = this.mangle('mailto:') + text;
                } else {
                    text = escape(cap[1]);
                    href = text;
                }
                out += this.renderer.link(href, null, text);
                continue;
            }

            // url (gfm)
            if (!this.inLink && (cap = this.rules.url.exec(src))) {
                src = src.substring(cap[0].length);
                text = escape(cap[1]);
                href = text;
                out += this.renderer.link(href, null, text);
                continue;
            }

            // tag
            if (cap = this.rules.tag.exec(src)) {
                if (!this.inLink && /^<a /i.test(cap[0])) {
                    this.inLink = true;
                } else if (this.inLink && /^<\/a>/i.test(cap[0])) {
                    this.inLink = false;
                }
                src = src.substring(cap[0].length);
                out += this.options.sanitize
                    ? escape(cap[0])
                    : cap[0];
                continue;
            }

            // link
            if (cap = this.rules.link.exec(src)) {
                src = src.substring(cap[0].length);
                this.inLink = true;
                out += this.outputLink(cap, {
                    href: cap[2],
                    title: cap[3]
                });
                this.inLink = false;
                continue;
            }

            // reflink, nolink
            if ((cap = this.rules.reflink.exec(src))
                || (cap = this.rules.nolink.exec(src))) {
                src = src.substring(cap[0].length);
                link = (cap[2] || cap[1]).replace(/\s+/g, ' ');
                link = this.links[link.toLowerCase()];
                if (!link || !link.href) {
                    out += cap[0].charAt(0);
                    src = cap[0].substring(1) + src;
                    continue;
                }
                this.inLink = true;
                out += this.outputLink(cap, link);
                this.inLink = false;
                continue;
            }

            // strong
            if (cap = this.rules.strong.exec(src)) {
                src = src.substring(cap[0].length);
                out += this.renderer.strong(this.output(cap[2] || cap[1]));
                continue;
            }

            // em
            if (cap = this.rules.em.exec(src)) {
                src = src.substring(cap[0].length);
                out += this.renderer.em(this.output(cap[2] || cap[1]));
                continue;
            }

            // code
            if (cap = this.rules.code.exec(src)) {
                src = src.substring(cap[0].length);
                out += this.renderer.codespan(escape(cap[2], true));
                continue;
            }

            // br
            if (cap = this.rules.br.exec(src)) {
                src = src.substring(cap[0].length);
                out += this.renderer.br();
                continue;
            }

            // del (gfm)
            if (cap = this.rules.del.exec(src)) {
                src = src.substring(cap[0].length);
                out += this.renderer.del(this.output(cap[1]));
                continue;
            }

            // emoji (gfm)
            if (cap = this.rules.emoji.exec(src)) {
                src = src.substring(cap[0].length);
                out += this.emoji(cap[1]);
                continue;
            }

            // text
            if (cap = this.rules.text.exec(src)) {
                src = src.substring(cap[0].length);
                out += escape(this.smartypants(cap[0]));
                continue;
            }

            if (src) {
                throw new
                    Error('Infinite loop on byte: ' + src.charCodeAt(0));
            }
        }

        return out;
    };

    /**
     * Compile Link
     */

    InlineLexer.prototype.outputLink = function (cap, link) {
        var href = escape(link.href)
            , title = link.title ? escape(link.title) : null;

        return cap[0].charAt(0) !== '!'
            ? this.renderer.link(href, title, this.output(cap[1]))
            : this.renderer.image(href, title, escape(cap[1]));
    };

    /**
     * Emoji Transformations
     */

    function emojiDefaultTemplate(emoji) {
        var _class = emoji.match(/fa-\S+/) === null ? '' : 'fa ' + emoji;
        return '<emoji '
                /* + 'src="'
                 + '../img/emoji/people/'
                 + encodeURIComponent(emoji)
                 + '.png"'
                 + ' alt=":'
                 + escape(emoji)
                 + ':"'
                 + ' title=":'
                 + escape(emoji)
                 + ':"'*/
            + ' class="'
            + _class
            + '"'
            + ' data-name="'
            + escape(emoji)
            + '"'
            + ' data-emoji="emoji '
            + escape(emoji)
            + '" align="absmiddle"><\/emoji>';
    }

    function getEmojiTemplate(options) {
        if (options.emoji) {
            if (typeof options.emoji === 'function') {
                return options.emoji;
            }

            if (typeof options.emoji === 'string') {
                var emojiSplit = options.emoji.split(/\{emoji\}/g);
                return function (emoji) {
                    return emojiSplit.join(emoji);
                }
            }
        }
        return emojiDefaultTemplate;
    }

    InlineLexer.prototype.emojiTemplate = emojiDefaultTemplate;
    InlineLexer.prototype.emoji = function (name) {
        if (!this.options.emoji) return ':' + name + ':';

        return this.emojiTemplate(name);
    };

    /**
     * Smartypants Transformations
     */

    InlineLexer.prototype.smartypants = function (text) {
        if (!this.options.smartypants) return text;
        return text
            // em-dashes
            .replace(/--/g, '\u2014')
            // opening singles
            .replace(/(^|[-\u2014/(\[{"\s])'/g, '$1\u2018')
            // closing singles & apostrophes
            .replace(/'/g, '\u2019')
            // opening doubles
            .replace(/(^|[-\u2014/(\[{\u2018\s])"/g, '$1\u201c')
            // closing doubles
            .replace(/"/g, '\u201d')
            // ellipses
            .replace(/\.{3}/g, '\u2026');
    };

    /**
     * Mangle Links
     */

    InlineLexer.prototype.mangle = function (text) {
        var out = ''
            , l = text.length
            , i = 0
            , ch;

        for (; i < l; i++) {
            ch = text.charCodeAt(i);
            if (Math.random() > 0.5) {
                ch = 'x' + ch.toString(16);
            }
            out += '&#' + ch + ';';
        }

        return out;
    };

    /**
     * Renderer
     */

    function Renderer(options) {
        this.options = options || {};
    }

    Renderer.prototype.code = function (code, lang, escaped) {
        if (this.options.highlight) {
            var out = this.options.highlight(code, lang);
            if (out != null && out !== code) {
                escaped = true;
                code = out;
            }
        }

        if (!lang) {
            return '<pre><code class="hljs">'
                + (escaped ? code : escape(code, true))
                + '\n</code></pre>';
        }

        return '<pre><code class="'
            + this.options.langPrefix
            + escape(lang, true)
            + ' hljs">'
            + (escaped ? code : escape(code, true))
            + '\n</code></pre>\n';
    };

    Renderer.prototype.blockquote = function (quote) {
        return '<blockquote>\n' + quote + '</blockquote>\n';
    };

    Renderer.prototype.html = function (html) {
        return html;
    };

    Renderer.prototype.heading = function (text, level, raw) {
        return '<h'
            + level
            + ' id="'
            + this.options.headerPrefix
            + raw.toLowerCase().replace(/[^\w]+/g, '-')
            + '">'
            + text
            + '</h'
            + level
            + '>\n';
    };

    Renderer.prototype.hr = function () {
        return this.options.xhtml ? '<hr/>\n' : '<hr>\n';
    };

    Renderer.prototype.list = function (body, ordered) {
        var type = ordered ? 'ol' : 'ul';
        return '<' + type + '>\n' + body + '</' + type + '>\n';
    };

    Renderer.prototype.listitem = function (text) {
        return '<li>' + text + '</li>\n';
    };

    Renderer.prototype.paragraph = function (text) {
        return '<p>' + text + '</p>\n';
    };

    Renderer.prototype.table = function (header, body) {
        return '<table>\n'
            + '<thead>\n'
            + header
            + '</thead>\n'
            + '<tbody>\n'
            + body
            + '</tbody>\n'
            + '</table>\n';
    };

    Renderer.prototype.tablerow = function (content) {
        return '<tr>\n' + content + '</tr>\n';
    };

    Renderer.prototype.tablecell = function (content, flags) {
        var type = flags.header ? 'th' : 'td';
        var tag = flags.align
            ? '<' + type + ' style="text-align:' + flags.align + '">'
            : '<' + type + '>';
        return tag + content + '</' + type + '>\n';
    };

// span level renderer
    Renderer.prototype.strong = function (text) {
        return '<strong>' + text + '</strong>';
    };

    Renderer.prototype.em = function (text) {
        return '<em>' + text + '</em>';
    };

    Renderer.prototype.codespan = function (text) {
        return '<code>' + text + '</code>';
    };

    Renderer.prototype.br = function () {
        return this.options.xhtml ? '<br/>' : '<br>';
    };

    Renderer.prototype.del = function (text) {
        return '<del>' + text + '</del>';
    };

    Renderer.prototype.link = function (href, title, text) {
        if (this.options.sanitize) {
            try {
                var prot = decodeURIComponent(unescape(href))
                    .replace(/[^\w:]/g, '')
                    .toLowerCase();
            } catch (e) {
                return '';
            }
            if (prot.indexOf('javascript:') === 0 || prot.indexOf('vbscript:') === 0) {
                return '';
            }
        }
        var out = '<a href="' + href + '"';
        if (title) {
            out += ' title="' + title + '"';
        }
        out += '>' + text + '</a>';
        return out;
    };

    Renderer.prototype.image = function (href, title, text) {
        var out = '<img src="' + href + '" alt="' + text + '"';
        if (title) {
            out += ' title="' + title + '"';
        }
        out += this.options.xhtml ? '/>' : '>';
        return out;
    };

    /**
     * Parsing & Compiling
     */

    function Parser(options) {
        this.tokens = [];
        this.token = null;
        this.options = options || marked.defaults;
        this.options.renderer = this.options.renderer || new Renderer;
        this.renderer = this.options.renderer;
        this.renderer.options = this.options;
    }

    /**
     * Static Parse Method
     */

    Parser.parse = function (src, options, renderer) {
        var parser = new Parser(options, renderer);
        return parser.parse(src);
    };

    /**
     * Parse Loop
     */

    Parser.prototype.parse = function (src) {
        this.inline = new InlineLexer(src.links, this.options, this.renderer);
        this.tokens = src.reverse();

        var out = '';
        while (this.next()) {
            out += this.tok();
        }

        return out;
    };

    /**
     * Next Token
     */

    Parser.prototype.next = function () {
        return this.token = this.tokens.pop();
    };

    /**
     * Preview Next Token
     */

    Parser.prototype.peek = function () {
        return this.tokens[this.tokens.length - 1] || 0;
    };

    /**
     * Parse Text Tokens
     */

    Parser.prototype.parseText = function () {
        var body = this.token.text;

        while (this.peek().type === 'text') {
            body += '\n' + this.next().text;
        }

        return this.inline.output(body);
    };

    /**
     * Parse Current Token
     */

    Parser.prototype.tok = function () {
        switch (this.token.type) {
            case 'space':
            {
                return '';
            }
            case 'hr':
            {
                return this.renderer.hr();
            }
            case 'heading':
            {
                return this.renderer.heading(
                    this.inline.output(this.token.text),
                    this.token.depth,
                    this.token.text);
            }
            case 'code':
            {
                return this.renderer.code(this.token.text,
                    this.token.lang,
                    this.token.escaped);
            }
            case 'table':
            {
                var header = ''
                    , body = ''
                    , i
                    , row
                    , cell
                    , flags
                    , j;

                // header
                cell = '';
                for (i = 0; i < this.token.header.length; i++) {
                    flags = {header: true, align: this.token.align[i]};
                    cell += this.renderer.tablecell(
                        this.inline.output(this.token.header[i]),
                        {header: true, align: this.token.align[i]}
                    );
                }
                header += this.renderer.tablerow(cell);

                for (i = 0; i < this.token.cells.length; i++) {
                    row = this.token.cells[i];

                    cell = '';
                    for (j = 0; j < row.length; j++) {
                        cell += this.renderer.tablecell(
                            this.inline.output(row[j]),
                            {header: false, align: this.token.align[j]}
                        );
                    }

                    body += this.renderer.tablerow(cell);
                }
                return this.renderer.table(header, body);
            }
            case 'blockquote_start':
            {
                var body = '';

                while (this.next().type !== 'blockquote_end') {
                    body += this.tok();
                }

                return this.renderer.blockquote(body);
            }
            case 'list_start':
            {
                var body = ''
                    , ordered = this.token.ordered;

                while (this.next().type !== 'list_end') {
                    body += this.tok();
                }

                return this.renderer.list(body, ordered);
            }
            case 'list_item_start':
            {
                var body = '';

                while (this.next().type !== 'list_item_end') {
                    body += this.token.type === 'text'
                        ? this.parseText()
                        : this.tok();
                }

                return this.renderer.listitem(body);
            }
            case 'loose_item_start':
            {
                var body = '';

                while (this.next().type !== 'list_item_end') {
                    body += this.tok();
                }

                return this.renderer.listitem(body);
            }
            case 'html':
            {
                var html = !this.token.pre && !this.options.pedantic
                    ? this.inline.output(this.token.text)
                    : this.token.text;
                return this.renderer.html(html);
            }
            case 'paragraph':
            {
                return this.renderer.paragraph(this.inline.output(this.token.text));
            }
            case 'text':
            {
                return this.renderer.paragraph(this.parseText());
            }
        }
    };

    /**
     * Helpers
     */

    function escape(html, encode) {
        return html
            .replace(!encode ? /&(?!#?\w+;)/g : /&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function unescape(html) {
        return html.replace(/&([#\w]+);/g, function (_, n) {
            n = n.toLowerCase();
            if (n === 'colon') return ':';
            if (n.charAt(0) === '#') {
                return n.charAt(1) === 'x'
                    ? String.fromCharCode(parseInt(n.substring(2), 16))
                    : String.fromCharCode(+n.substring(1));
            }
            return '';
        });
    }

    function replace(regex, opt) {
        regex = regex.source;
        opt = opt || '';
        return function self(name, val) {
            if (!name) return new RegExp(regex, opt);
            val = val.source || val;
            val = val.replace(/(^|[^\[])\^/g, '$1');
            regex = regex.replace(name, val);
            return self;
        };
    }

    function noop() {
    }

    noop.exec = noop;

    function merge(obj) {
        var i = 1
            , target
            , key;

        for (; i < arguments.length; i++) {
            target = arguments[i];
            for (key in target) {
                if (Object.prototype.hasOwnProperty.call(target, key)) {
                    obj[key] = target[key];
                }
            }
        }

        return obj;
    }


    /**
     * Marked
     */

    function marked(src, opt, callback) {
        if (callback || typeof opt === 'function') {
            if (!callback) {
                callback = opt;
                opt = null;
            }

            opt = merge({}, marked.defaults, opt || {});

            var highlight = opt.highlight
                , tokens
                , pending
                , i = 0;

            try {
                tokens = Lexer.lex(src, opt)
            } catch (e) {
                return callback(e);
            }

            pending = tokens.length;

            var done = function (err) {
                if (err) {
                    opt.highlight = highlight;
                    return callback(err);
                }

                var out;

                try {
                    out = Parser.parse(tokens, opt);
                } catch (e) {
                    err = e;
                }

                opt.highlight = highlight;

                return err
                    ? callback(err)
                    : callback(null, out);
            };

            if (!highlight || highlight.length < 3) {
                return done();
            }

            delete opt.highlight;

            if (!pending) return done();

            for (; i < tokens.length; i++) {
                (function (token) {
                    if (token.type !== 'code') {
                        return --pending || done();
                    }
                    return highlight(token.text, token.lang, function (err, code) {
                        if (err) return done(err);
                        if (code == null || code === token.text) {
                            return --pending || done();
                        }
                        token.text = code;
                        token.escaped = true;
                        --pending || done();
                    });
                })(tokens[i]);
            }

            return;
        }
        try {
            if (opt) opt = merge({}, marked.defaults, opt);
            return Parser.parse(Lexer.lex(src, opt), opt);
        } catch (e) {
            e.message += '\nPlease report this to https://github.com/chjj/marked.';
            if ((opt || marked.defaults).silent) {
                return '<p>An error occured:</p><pre>'
                    + escape(e.message + '', true)
                    + '</pre>';
            }
            throw e;
        }
    }

    /**
     * Options
     */

    marked.options =
        marked.setOptions = function (opt) {
            merge(marked.defaults, opt);
            return marked;
        };

    marked.defaults = {
        gfm: true,
        emoji: false,
        tables: true,
        breaks: false,
        pedantic: false,
        sanitize: false,
        smartLists: false,
        silent: false,
        highlight: null,
        langPrefix: 'lang-',
        smartypants: false,
        headerPrefix: '',
        renderer: new Renderer,
        xhtml: false
    };

    /**
     * Expose
     */

    marked.Parser = Parser;
    marked.parser = Parser.parse;

    marked.Renderer = Renderer;

    marked.Lexer = Lexer;
    marked.lexer = Lexer.lex;

    marked.InlineLexer = InlineLexer;
    marked.inlineLexer = InlineLexer.output;

    marked.parse = marked;

    if (typeof module !== 'undefined' && typeof exports === 'object') {
        module.exports = marked;
    } else if (typeof define === 'function' && define.amd) {
        define(function () {
            return marked;
        });
    } else {
        this.marked = marked;
    }

}).call(function () {
        return this || (typeof window !== 'undefined' ? window : global);
    }());
// Source: public/javascripts/vendor/markdown/to-markdown.js
/*
 * to-markdown - an HTML to Markdown converter
 *
 * Copyright 2011, Dom Christie
 * Licenced under the MIT licence
 *
 */

if (typeof he !== 'object' && typeof require === 'function') {
    var he = require('he');
}

var toMarkdown = function (string) {

    var ELEMENTS = [
        {
            patterns: 'p',
            replacement: function (str, attrs, innerHTML) {
                return innerHTML ? '\n\n' + innerHTML + '\n' : '';
            }
        },
        {
            patterns: 'br',
            type: 'void',
            replacement: '  \n'
        },
        {
            patterns: 'h([1-6])',
            replacement: function (str, hLevel, attrs, innerHTML) {
                var hPrefix = '';
                for (var i = 0; i < hLevel; i++) {
                    hPrefix += '#';
                }
                return '\n\n' + hPrefix + ' ' + innerHTML + '\n';
            }
        },
        {
            patterns: 'hr',
            type: 'void',
            replacement: '\n\n* * *\n'
        },
        {
            patterns: 'a',
            replacement: function (str, attrs, innerHTML) {
                var href = attrs.match(attrRegExp('href')),
                    title = attrs.match(attrRegExp('title'));
                return href ? '[' + innerHTML + ']' + '(' + href[1] + (title && title[1] ? ' "' + title[1] + '"' : '') + ')' : str;
            }
        },
        {
            patterns: ['b', 'strong'],
            replacement: function (str, attrs, innerHTML) {
                return innerHTML ? '**' + innerHTML + '**' : '';
            }
        },
        {
            patterns: ['i', 'em'],
            replacement: function (str, attrs, innerHTML) {
                return innerHTML ? '_' + innerHTML + '_' : '';
            }
        },
        {
            patterns: 'code',
            replacement: function (str, attrs, innerHTML) {
                var language = '';
                if (attrs) {
                    var langs = attrs.match(/"lang-\S+"/);
                    if (langs && langs.length > 0) {
                        var lang = langs[0];
                        if (lang) {
                            var _language = lang.substring(lang.indexOf('-') + 1, lang.length - 1);
                            if (_language)
                                language = _language;
                        }
                    }
                }
                innerHTML = innerHTML.replace(/&lt;/g, "$-lt+$")
                    .replace(/&gt;/g, "$-gt+$");
                var code = he.decode(innerHTML, {'isAttributeValue': true});
                return innerHTML ? '```' + language + '\n' + code + '```' : '';
            }
        },
        {
            patterns: 'img',
            type: 'void',
            replacement: function (str, attrs, innerHTML) {
                var src = attrs.match(attrRegExp('src')),
                    alt = attrs.match(attrRegExp('alt')),
                    title = attrs.match(attrRegExp('title'));
                return src ? '![' + (alt && alt[1] ? alt[1] : '') + ']' + '(' + src[1] + (title && title[1] ? ' "' + title[1] + '"' : '') + ')' : '';
            }
        }, {
            patterns: 'emoji',
            replacement: function (str, attrs, innerHTML) {
                var _emoji = '',
                    emoji = attrs.match(/data-name="\S+"/);
                if (emoji && emoji.length>0) {
                    _emoji = emoji[0]?emoji[0].substring(emoji[0].indexOf('=') + 2, emoji[0].length - 1):_emoji;
                }
                return attrs ? ':emoji[' + _emoji + ']:' : '';
            }
        }
    ];

    for (var i = 0, len = ELEMENTS.length; i < len; i++) {
        if (typeof ELEMENTS[i].patterns === 'string') {
            string = replaceEls(string, {
                tag: ELEMENTS[i].patterns,
                replacement: ELEMENTS[i].replacement,
                type: ELEMENTS[i].type
            });
        }
        else {
            for (var j = 0, pLen = ELEMENTS[i].patterns.length; j < pLen; j++) {
                string = replaceEls(string, {
                    tag: ELEMENTS[i].patterns[j],
                    replacement: ELEMENTS[i].replacement,
                    type: ELEMENTS[i].type
                });
            }
        }
    }

    function replaceEls(html, elProperties) {
        var pattern = elProperties.type === 'void' ? '<' + elProperties.tag + '\\b([^>]*)\\/?>' : '<' + elProperties.tag + '\\b([^>]*)>([\\s\\S]*?)<\\/' + elProperties.tag + '>',
            regex = new RegExp(pattern, 'gi'),
            markdown = '';
        if (typeof elProperties.replacement === 'string') {
            markdown = html.replace(regex, elProperties.replacement);
        }
        else {
            markdown = html.replace(regex, function (str, p1, p2, p3) {
                return elProperties.replacement.call(this, str, p1, p2, p3);
            });
        }
        return markdown;
    }

    function attrRegExp(attr) {
        return new RegExp(attr + '\\s*=\\s*["\']?([^"\']*)["\']?', 'i');
    }

    // Pre code blocks

    string = string.replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, function (str, innerHTML) {
        var text = he.decode(innerHTML);
        text = text.replace(/^\t+/g, '  '); // convert tabs to spaces (you know it makes sense)
        //text = text.replace(/\n/g, '\n    ');
        return '\n' + text;
    });

    // Lists

    // Escape numbers that could trigger an ol
    // If there are more than three spaces before the code, it would be in a pre tag
    // Make sure we are escaping the period not matching any character
    string = string.replace(/^(\s{0,3}\d+)\. /g, '$1\\. ');

    // Converts lists that have no child lists (of same type) first, then works its way up
    var noChildrenRegex = /<(ul|ol)\b[^>]*>(?:(?!<ul|<ol)[\s\S])*?<\/\1>/gi;
    while (string.match(noChildrenRegex)) {
        string = string.replace(noChildrenRegex, function (str) {
            return replaceLists(str);
        });
    }

    function replaceLists(html) {

        html = html.replace(/<(ul|ol)\b[^>]*>([\s\S]*?)<\/\1>/gi, function (str, listType, innerHTML) {
            var lis = innerHTML.split('</li>');
            lis.splice(lis.length - 1, 1);

            for (i = 0, len = lis.length; i < len; i++) {
                if (lis[i]) {
                    var prefix = (listType === 'ol') ? (i + 1) + ".  " : "*   ";
                    lis[i] = lis[i].replace(/\s*<li[^>]*>([\s\S]*)/i, function (str, innerHTML) {

                        innerHTML = innerHTML.replace(/^\s+/, '');
                        innerHTML = innerHTML.replace(/\n\n/g, '\n\n    ');
                        // indent nested lists
                        innerHTML = innerHTML.replace(/\n([ ]*)+(\*|\d+\.) /g, '\n$1    $2 ');
                        return prefix + innerHTML;
                    });
                }
                lis[i] = lis[i].replace(/(.) +$/m, '$1');
            }
            return lis.join('\n');
        });

        return html.replace(/[ \t]+\n|\s+$/g, '');
    }

    // Blockquotes
    var deepest = /<blockquote\b[^>]*>((?:(?!<blockquote)[\s\S])*?)<\/blockquote>/gi;
    while (string.match(deepest)) {
        string = string.replace(deepest, function (str) {
            return replaceBlockquotes(str);
        });
    }

    function replaceBlockquotes(html) {
        html = html.replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, function (str, inner) {
            inner = inner.replace(/^\s+|\s+$/g, '');
            inner = cleanUp(inner);
            inner = inner.replace(/^/gm, '> ');
            inner = inner.replace(/^(>([ \t]{2,}>)+)/gm, '> >');
            return inner;
        });
        return html;
    }

    function cleanUp(string) {
        string = string.replace(/^[\t\r\n]+|[\t\r\n]+$/g, ''); // trim leading/trailing whitespace
        string = string.replace(/\n\s+\n/g, '\n\n');
        string = string.replace(/\n{3,}/g, '\n\n'); // limit consecutive linebreaks to 2
        return string;
    }

    return cleanUp(string);
};

if (typeof exports === 'object') {
    exports.toMarkdown = toMarkdown;
}
// Source: public/javascripts/vendor/markdown/jsHtmlToText.js
/*
 Copyright (C) 2006 Google Inc.

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.

 HTML decoding functionality provided by: http://code.google.com/p/google-trekker/
 */

/*
 adam-p: modified to be a module
 */

;
(function () {


    function htmlToText(html, extensions) {

        var text = html, i;

        if (extensions && extensions['preprocessing'])
            text = extensions['preprocessing'](text);

        text = text
            // Remove line breaks
            //.replace(/(?:\n|\r\n|\r)/ig, " ")
            // Remove content in script tags.
            .replace(/<\s*script[^>]*>[\s\S]*?<\/script>/mig, "")
            // Remove content in style tags.
            .replace(/<\s*style[^>]*>[\s\S]*?<\/style>/mig, "")
            // Remove content in comments.
            .replace(/<!--.*?-->/mig, "")
            // Remove !DOCTYPE
            .replace(/<!DOCTYPE.*?>/ig, "");

        /* I scanned http://en.wikipedia.org/wiki/HTML_element for all html tags.
         I put those tags that should affect plain text formatting in two categories:
         those that should be replaced with two newlines and those that should be
         replaced with one newline. */

        if (extensions && extensions['tagreplacement'])
            text = extensions['tagreplacement'](text);

        var doubleNewlineTags = ['p', 'h[1-6]', 'dl', 'dt', 'dd', 'ol', 'ul',
            'dir', 'address', 'blockquote', 'center', 'div', 'hr', 'pre', 'form',
            'textarea', 'table'];

        var singleNewlineTags = ['li', 'del', 'ins', 'fieldset', 'legend',
            'tr', 'th', 'caption', 'thead', 'tbody', 'tfoot'];

        for (i = 0; i < doubleNewlineTags.length; i++) {
            var r = RegExp('</?\\s*' + doubleNewlineTags[i] + '[^>]*>', 'ig');
            text = text.replace(r, '\n\n');
        }

        for (i = 0; i < singleNewlineTags.length; i++) {
            var r = RegExp('<\\s*' + singleNewlineTags[i] + '[^>]*>', 'ig');
            text = text.replace(r, '\n');
        }

        // Replace <br> and <br/> with a single newline
        text = text.replace(/<\s*br[^>]*\/?\s*>/ig, '\n');

        text = text
            // Remove all remaining tags.
            .replace(/(<([^>]+)>)/ig, "")
            // Make sure there are never more than two
            // consecutive linebreaks.
            .replace(/\n{2,}/g, "\n\n")
            // Remove newlines at the beginning of the text.
            .replace(/^\n+/, "")
            // Remove newlines at the end of the text.
            .replace(/\n+$/, "")
            // Decode HTML entities.
            .replace(/&([^;]+);/g, decodeHtmlEntity);

        /* adam-p: make trailing whitespace stripping optional */

        if (!extensions || !extensions['allowTrailingWhitespace']) {
            text = text
                // Trim rightmost whitespaces for all lines
                .replace(/([^\n\S]+)\n/g, "\n")
                .replace(/([^\n\S]+)$/, "");
        }

        if (extensions && extensions['postprocessing'])
            text = extensions['postprocessing'](text);
        text = text.replace(/\$-lt\+\$/g, "<")
            .replace(/\$-gt\+\$/g, ">");
        return text;
    }

    function decodeHtmlEntity(m, n) {
        // Determine the character code of the entity. Range is 0 to 65535
        // (characters in JavaScript are Unicode, and entities can represent
        // Unicode characters).
        var code;

        // Try to parse as numeric entity. This is done before named entities for
        // speed because associative array lookup in many JavaScript implementations
        // is a linear search.
        if (n.substr(0, 1) == '#') {
            // Try to parse as numeric entity
            if (n.substr(1, 1) == 'x') {
                // Try to parse as hexadecimal
                code = parseInt(n.substr(2), 16);
            } else {
                // Try to parse as decimal
                code = parseInt(n.substr(1), 10);
            }
        } else {
            // Try to parse as named entity
            code = ENTITIES_MAP[n];
        }

        // If still nothing, pass entity through
        return (code === undefined || code === NaN) ?
        '&' + n + ';' : String.fromCharCode(code);
    }

    var ENTITIES_MAP = {
        'nbsp': 160,
        'iexcl': 161,
        'cent': 162,
        'pound': 163,
        'curren': 164,
        'yen': 165,
        'brvbar': 166,
        'sect': 167,
        'uml': 168,
        'copy': 169,
        'ordf': 170,
        'laquo': 171,
        'not': 172,
        'shy': 173,
        'reg': 174,
        'macr': 175,
        'deg': 176,
        'plusmn': 177,
        'sup2': 178,
        'sup3': 179,
        'acute': 180,
        'micro': 181,
        'para': 182,
        'middot': 183,
        'cedil': 184,
        'sup1': 185,
        'ordm': 186,
        'raquo': 187,
        'frac14': 188,
        'frac12': 189,
        'frac34': 190,
        'iquest': 191,
        'Agrave': 192,
        'Aacute': 193,
        'Acirc': 194,
        'Atilde': 195,
        'Auml': 196,
        'Aring': 197,
        'AElig': 198,
        'Ccedil': 199,
        'Egrave': 200,
        'Eacute': 201,
        'Ecirc': 202,
        'Euml': 203,
        'Igrave': 204,
        'Iacute': 205,
        'Icirc': 206,
        'Iuml': 207,
        'ETH': 208,
        'Ntilde': 209,
        'Ograve': 210,
        'Oacute': 211,
        'Ocirc': 212,
        'Otilde': 213,
        'Ouml': 214,
        'times': 215,
        'Oslash': 216,
        'Ugrave': 217,
        'Uacute': 218,
        'Ucirc': 219,
        'Uuml': 220,
        'Yacute': 221,
        'THORN': 222,
        'szlig': 223,
        'agrave': 224,
        'aacute': 225,
        'acirc': 226,
        'atilde': 227,
        'auml': 228,
        'aring': 229,
        'aelig': 230,
        'ccedil': 231,
        'egrave': 232,
        'eacute': 233,
        'ecirc': 234,
        'euml': 235,
        'igrave': 236,
        'iacute': 237,
        'icirc': 238,
        'iuml': 239,
        'eth': 240,
        'ntilde': 241,
        'ograve': 242,
        'oacute': 243,
        'ocirc': 244,
        'otilde': 245,
        'ouml': 246,
        'divide': 247,
        'oslash': 248,
        'ugrave': 249,
        'uacute': 250,
        'ucirc': 251,
        'uuml': 252,
        'yacute': 253,
        'thorn': 254,
        'yuml': 255,
        'quot': 34,
        'amp': 38,
        'lt': 60,
        'gt': 62,
        'OElig': 338,
        'oelig': 339,
        'Scaron': 352,
        'scaron': 353,
        'Yuml': 376,
        'circ': 710,
        'tilde': 732,
        'ensp': 8194,
        'emsp': 8195,
        'thinsp': 8201,
        'zwnj': 8204,
        'zwj': 8205,
        'lrm': 8206,
        'rlm': 8207,
        'ndash': 8211,
        'mdash': 8212,
        'lsquo': 8216,
        'rsquo': 8217,
        'sbquo': 8218,
        'ldquo': 8220,
        'rdquo': 8221,
        'bdquo': 8222,
        'dagger': 8224,
        'Dagger': 8225,
        'permil': 8240,
        'lsaquo': 8249,
        'rsaquo': 8250,
        'euro': 8364
    };

    var EXPORTED_SYMBOLS = ['htmlToText'];

    if (typeof module !== 'undefined') {
        module.exports = htmlToText;
    } else {
        this.htmlToText = htmlToText;
        this.EXPORTED_SYMBOLS = EXPORTED_SYMBOLS;
    }

}).call(function () {
        return this || (typeof window !== 'undefined' ? window : global);
    }());

// Source: public/javascripts/vendor/markdown/tab.js
/**
 * Created by ling on 2015/1/13.
 */
var stopEvent = function (evt) {
    evt = evt || window.event;

    if (evt.preventDefault) {
        evt.preventDefault();
        evt.stopPropagation();
    }
    if (evt.returnValue)
        evt.returnValue = false;
    if (evt.cancelBubble)
        evt.cancelBubble = true;
    return false;
};

String.prototype.trim = function () {
    return this.replace(/(^\s*)|(\s*$)/g, '');
};

String.prototype.lastChar = function () {
    return this.charAt(this.length - 1);
};

String.prototype.fristChar = function () {
    return this.charAt(0);
};

String.prototype.toUnicode = function () {
    var temp,
        i = 0,
        r = '',
        len = this.length;

    for (; i < len; i++) {
        temp = this.charCodeAt(i).toString(16);
        while (temp.length < 4)
            temp = '0' + temp;

        r += '\\u' + temp;
    }
    return r;
};
String.prototype.countOf = function (reg) {
    if (undefined !== reg)
        return (this.match(reg) || []).length;
    return 0;
};

String.prototype.countOfTab = function () {
    var reg = /\u0020{4}/g;
    return (this.match(reg) || []).length;
};

String.prototype.countOfTabEnter = function () {
    var reg = /\u0020{4}\u000a/g;
    return (this.match(reg) || []).length;
};

String.prototype.countOfTabInCloseTag = function () {
    var reg = /\u007b\u000a*\u0020{4}\u000a*\u007d/g;
    return (this.match(reg) || []).length;
};

var tabFunc = function (evt) {
    evt = evt || window.event;
    var keyCode = evt.keyCode,
        tab = 9,
        enter = 13,
        key_y = 89,
        key_z = 90;
    var target = evt.target,
        selectionStart = -1,
        selectionEnd = -1,
        tabKey = '\u0020\u0020\u0020\u0020',
        doubleTabKey = tabKey + tabKey,
        enterKey = '\u000a',
        value = '',
        prefix = '',
        suffix = '';
    if (target && target.tagName === 'TEXTAREA') {
        selectionStart = target.selectionStart;
        selectionEnd = target.selectionEnd;
        value = target.value;
        if (selectionStart < 0 || selectionEnd < 0) {
            return stopEvent(evt);
        } else {
            prefix = value.substring(0, selectionStart);
            suffix = value.substring(selectionEnd);
        }
    } else {
        return;
    }

    //tab
    if (keyCode === tab) {
        var _value = prefix + tabKey + suffix;

        selectionStart += 4;
        selectionEnd = selectionStart;
        target.value = _value;
        target.setSelectionRange(selectionStart, selectionEnd);
        return stopEvent(evt);
    }

    //enter
    if (keyCode === enter) {
        //{}
        var _value = '',
            frist = prefix.trim().lastChar(),
            last = suffix.trim().fristChar(),
            count = prefix.countOf(/\u000a/g);
        if (('\u003b' === frist || '\u0029' === frist || '\u007b' === frist) && '\u007d' === last) {
            if (count === 0) {
                _value = prefix + enterKey + tabKey + enterKey + suffix;
                selectionStart += 5;
            } else if (count > 0) {
                var tabs = prefix.substring(prefix.lastIndexOf('\u000a'), selectionStart).countOfTab(), i = 0, tabStr = '';
                for (; i < tabs; ++i) {
                    tabStr += tabKey;
                }
                _value += prefix;
                _value += enterKey;
                _value += tabStr;
                if ('\u003b' !== frist) {
                    _value += tabKey;
                    ++tabs;
                }
                if (enterKey !== suffix.fristChar()) {
                    _value += enterKey;
                    _value += tabStr;
                }
                _value += suffix;

                selectionStart += 1 + (tabs * 4);
            }
        } else {
            //fix Ctrl+z and Ctrl+y bug
            return;
            /*_value = prefix + enterKey + suffix;
            ++selectionStart;*/
        }

        selectionEnd = selectionStart;
        target.value = _value;
        target.setSelectionRange(selectionStart, selectionEnd);
        return stopEvent(evt);
    }

};

window.document.addEventListener('keydown', tabFunc, false);
// Source: public/javascripts/vendor/markdown/config.js
/**
 * Created by ling on 2015/3/3.
 */
hljs.configure({useBR: false});
hljs.initHighlightingOnLoad();

marked.setOptions({
    renderer: new marked.Renderer(),
    gfm: true,
    emoji: true,
    tables: true,
    breaks: false,
    pedantic: false,
    sanitize: true,
    smartLists: true,
    smartypants: false,
    highlight: function (code, lang) {
        try {
            if (lang)
                return hljs.highlight(lang, code).value;
        } catch (e) {
            return hljs.highlightAuto(code).value;
        }
        return hljs.highlightAuto(code).value;
    }
});
// Source: public/javascripts/vendor/markdown/bootstrap-markdown.js
/* ===================================================
 * bootstrap-markdown.js v2.8.0
 * http://github.com/toopay/bootstrap-markdown
 * ===================================================
 * Copyright 2013-2014 Taufan Aditya
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================== */

!function ($) {

// jshint ;_;

    /* MARKDOWN CLASS DEFINITION
     * ========================== */

    var Markdown = function (element, options) {
        // @TODO : remove this BC on next major release
        // @see : https://github.com/toopay/bootstrap-markdown/issues/109
        var opts = ['autofocus', 'savable', 'hideable', 'width',
            'height', 'resize', 'iconlibrary', 'language', 'imgurl', 'base64url', 'localStorage',
            'footer', 'fullscreen', 'hiddenButtons', 'disabledButtons'];
        $.each(opts, function (_, opt) {
            if (typeof $(element).data(opt) !== 'undefined') {
                options = typeof options == 'object' ? options : {};
                options[opt] = $(element).data(opt)
            }
        });
        // End BC

        //emoji
        this.$emoji = {
            groupNav: {'github-emoji': null, 'twemoji': null, 'font-awesome': null},
            groupName: ['github-emoji', 'twemoji', 'font-awesome'],
            groupPanel: {'github-emoji': null, 'twemoji': null, 'font-awesome': null},
            groups: {
                "github-emoji": {
                    "People": ["bowtie", "smile", "laughing", "blush", "smiley", "relaxed", "smirk", "heart_eyes", "kissing_heart", "kissing_closed_eyes", "flushed", "relieved", "satisfied", "grin", "wink", "stuck_out_tongue_winking_eye", "stuck_out_tongue_closed_eyes", "grinning", "kissing", "kissing_smiling_eyes", "stuck_out_tongue", "sleeping", "worried", "frowning", "anguished", "open_mouth", "grimacing", "confused", "hushed", "expressionless", "unamused", "sweat_smile", "sweat", "disappointed_relieved", "weary", "pensive", "disappointed", "confounded", "fearful", "cold_sweat", "persevere", "cry", "sob", "joy", "astonished", "scream", "neckbeard", "tired_face", "angry", "rage", "triumph", "sleepy", "yum", "mask", "sunglasses", "dizzy_face", "imp", "smiling_imp", "neutral_face", "no_mouth", "innocent", "alien", "yellow_heart", "blue_heart", "purple_heart", "heart", "green_heart", "broken_heart", "heartbeat", "heartpulse", "two_hearts", "revolving_hearts", "cupid", "sparkling_heart", "sparkles", "star", "star2", "dizzy", "boom", "collision", "anger", "exclamation", "question", "grey_exclamation", "grey_question", "zzz", "dash", "sweat_drops", "notes", "musical_note", "fire", "hankey", "poop", "shit", "+1", "thumbsup", "-1", "thumbsdown", "ok_hand", "punch", "facepunch", "fist", "v", "wave", "hand", "raised_hand", "open_hands", "point_up", "point_down", "point_left", "point_right", "raised_hands", "pray", "point_up_2", "clap", "muscle", "metal", "fu", "walking", "runner", "running", "couple", "family", "two_men_holding_hands", "two_women_holding_hands", "dancer", "dancers", "ok_woman", "no_good", "information_desk_person", "raising_hand", "bride_with_veil", "person_with_pouting_face", "person_frowning", "bow", "couplekiss", "couple_with_heart", "massage", "haircut", "nail_care", "boy", "girl", "woman", "man", "baby", "older_woman", "older_man", "person_with_blond_hair", "man_with_gua_pi_mao", "man_with_turban", "construction_worker", "cop", "angel", "princess", "smiley_cat", "smile_cat", "heart_eyes_cat", "kissing_cat", "smirk_cat", "scream_cat", "crying_cat_face", "joy_cat", "pouting_cat", "japanese_ogre", "japanese_goblin", "see_no_evil", "hear_no_evil", "speak_no_evil", "guardsman", "skull", "feet", "lips", "kiss", "droplet", "ear", "eyes", "nose", "tongue", "love_letter", "bust_in_silhouette", "busts_in_silhouette", "speech_balloon", "thought_balloon", "feelsgood", "finnadie", "goberserk", "godmode", "hurtrealbad", "rage1", "rage2", "rage3", "rage4", "suspect", "trollface"],
                    "Nature": ["sunny", "umbrella", "cloud", "snowflake", "snowman", "zap", "cyclone", "foggy", "ocean", "cat", "dog", "mouse", "hamster", "rabbit", "wolf", "frog", "tiger", "koala", "bear", "pig", "pig_nose", "cow", "boar", "monkey_face", "monkey", "horse", "racehorse", "camel", "sheep", "elephant", "panda_face", "snake", "bird", "baby_chick", "hatched_chick", "hatching_chick", "chicken", "penguin", "turtle", "bug", "honeybee", "ant", "beetle", "snail", "octopus", "tropical_fish", "fish", "whale", "whale2", "dolphin", "cow2", "ram", "rat", "water_buffalo", "tiger2", "rabbit2", "dragon", "goat", "rooster", "dog2", "pig2", "mouse2", "ox", "dragon_face", "blowfish", "crocodile", "dromedary_camel", "leopard", "cat2", "poodle", "paw_prints", "bouquet", "cherry_blossom", "tulip", "four_leaf_clover", "rose", "sunflower", "hibiscus", "maple_leaf", "leaves", "fallen_leaf", "herb", "mushroom", "cactus", "palm_tree", "evergreen_tree", "deciduous_tree", "chestnut", "seedling", "blossom", "ear_of_rice", "shell", "globe_with_meridians", "sun_with_face", "full_moon_with_face", "new_moon_with_face", "new_moon", "waxing_crescent_moon", "first_quarter_moon", "waxing_gibbous_moon", "full_moon", "waning_gibbous_moon", "last_quarter_moon", "waning_crescent_moon", "last_quarter_moon_with_face", "first_quarter_moon_with_face", "moon", "earth_africa", "earth_americas", "earth_asia", "volcano", "milky_way", "partly_sunny", "octocat", "squirrel"],
                    "Objects": ["bamboo", "gift_heart", "dolls", "school_satchel", "mortar_board", "flags", "fireworks", "sparkler", "wind_chime", "rice_scene", "jack_o_lantern", "ghost", "santa", "christmas_tree", "gift", "bell", "no_bell", "tanabata_tree", "tada", "confetti_ball", "balloon", "crystal_ball", "cd", "dvd", "floppy_disk", "camera", "video_camera", "movie_camera", "computer", "tv", "iphone", "phone", "telephone", "telephone_receiver", "pager", "fax", "minidisc", "vhs", "sound", "speaker", "mute", "loudspeaker", "mega", "hourglass", "hourglass_flowing_sand", "alarm_clock", "watch", "radio", "satellite", "loop", "mag", "mag_right", "unlock", "lock", "lock_with_ink_pen", "closed_lock_with_key", "key", "bulb", "flashlight", "high_brightness", "low_brightness", "electric_plug", "battery", "calling", "email", "mailbox", "postbox", "bath", "bathtub", "shower", "toilet", "wrench", "nut_and_bolt", "hammer", "seat", "moneybag", "yen", "dollar", "pound", "euro", "credit_card", "money_with_wings", "e-mail", "inbox_tray", "outbox_tray", "envelope", "incoming_envelope", "postal_horn", "mailbox_closed", "mailbox_with_mail", "mailbox_with_no_mail", "package", "door", "smoking", "bomb", "gun", "hocho", "pill", "syringe", "page_facing_up", "page_with_curl", "bookmark_tabs", "bar_chart", "chart_with_upwards_trend", "chart_with_downwards_trend", "scroll", "clipboard", "calendar", "date", "card_index", "file_folder", "open_file_folder", "scissors", "pushpin", "paperclip", "black_nib", "pencil2", "straight_ruler", "triangular_ruler", "closed_book", "green_book", "blue_book", "orange_book", "notebook", "notebook_with_decorative_cover", "ledger", "books", "bookmark", "name_badge", "microscope", "telescope", "newspaper", "football", "basketball", "soccer", "baseball", "tennis", "8ball", "rugby_football", "bowling", "golf", "mountain_bicyclist", "bicyclist", "horse_racing", "snowboarder", "swimmer", "surfer", "ski", "spades", "hearts", "clubs", "diamonds", "gem", "ring", "trophy", "musical_score", "musical_keyboard", "violin", "space_invader", "video_game", "black_joker", "flower_playing_cards", "game_die", "dart", "mahjong", "clapper", "memo", "pencil", "book", "art", "microphone", "headphones", "trumpet", "saxophone", "guitar", "shoe", "sandal", "high_heel", "lipstick", "boot", "shirt", "tshirt", "necktie", "womans_clothes", "dress", "running_shirt_with_sash", "jeans", "kimono", "bikini", "ribbon", "tophat", "crown", "womans_hat", "mans_shoe", "closed_umbrella", "briefcase", "handbag", "pouch", "purse", "eyeglasses", "fishing_pole_and_fish", "coffee", "tea", "sake", "baby_bottle", "beer", "beers", "cocktail", "tropical_drink", "wine_glass", "fork_and_knife", "pizza", "hamburger", "fries", "poultry_leg", "meat_on_bone", "spaghetti", "curry", "fried_shrimp", "bento", "sushi", "fish_cake", "rice_ball", "rice_cracker", "rice", "ramen", "stew", "oden", "dango", "egg", "bread", "doughnut", "custard", "icecream", "ice_cream", "shaved_ice", "birthday", "cake", "cookie", "chocolate_bar", "candy", "lollipop", "honey_pot", "apple", "green_apple", "tangerine", "lemon", "cherries", "grapes", "watermelon", "strawberry", "peach", "melon", "banana", "pear", "pineapple", "sweet_potato", "eggplant", "tomato", "corn"],
                    "Places": ["house", "house_with_garden", "school", "office", "post_office", "hospital", "bank", "convenience_store", "love_hotel", "hotel", "wedding", "church", "department_store", "european_post_office", "city_sunrise", "city_sunset", "japanese_castle", "european_castle", "tent", "factory", "tokyo_tower", "japan", "mount_fuji", "sunrise_over_mountains", "sunrise", "stars", "statue_of_liberty", "bridge_at_night", "carousel_horse", "rainbow", "ferris_wheel", "fountain", "roller_coaster", "ship", "speedboat", "boat", "sailboat", "rowboat", "anchor", "rocket", "airplane", "helicopter", "steam_locomotive", "tram", "mountain_railway", "bike", "aerial_tramway", "suspension_railway", "mountain_cableway", "tractor", "blue_car", "oncoming_automobile", "car", "red_car", "taxi", "oncoming_taxi", "articulated_lorry", "bus", "oncoming_bus", "rotating_light", "police_car", "oncoming_police_car", "fire_engine", "ambulance", "minibus", "truck", "train", "station", "train2", "bullettrain_front", "bullettrain_side", "light_rail", "monorail", "railway_car", "trolleybus", "ticket", "fuelpump", "vertical_traffic_light", "traffic_light", "warning", "construction", "beginner", "atm", "slot_machine", "busstop", "barber", "hotsprings", "checkered_flag", "crossed_flags", "izakaya_lantern", "moyai", "circus_tent", "performing_arts", "round_pushpin", "triangular_flag_on_post", "jp", "kr", "cn", "us", "fr", "es", "it", "ru", "gb", "uk", "de"],
                    "Symbols": ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "keycap_ten", "1234", "zero", "hash", "symbols", "arrow_backward", "arrow_down", "arrow_forward", "arrow_left", "capital_abcd", "abcd", "abc", "arrow_lower_left", "arrow_lower_right", "arrow_right", "arrow_up", "arrow_upper_left", "arrow_upper_right", "arrow_double_down", "arrow_double_up", "arrow_down_small", "arrow_heading_down", "arrow_heading_up", "leftwards_arrow_with_hook", "arrow_right_hook", "left_right_arrow", "arrow_up_down", "arrow_up_small", "arrows_clockwise", "arrows_counterclockwise", "rewind", "fast_forward", "information_source", "ok", "twisted_rightwards_arrows", "repeat", "repeat_one", "new", "top", "up", "cool", "free", "ng", "cinema", "koko", "signal_strength", "u5272", "u5408", "u55b6", "u6307", "u6708", "u6709", "u6e80", "u7121", "u7533", "u7a7a", "u7981", "sa", "restroom", "mens", "womens", "baby_symbol", "no_smoking", "parking", "wheelchair", "metro", "baggage_claim", "accept", "wc", "potable_water", "put_litter_in_its_place", "secret", "congratulations", "m", "passport_control", "left_luggage", "customs", "ideograph_advantage", "cl", "sos", "id", "no_entry_sign", "underage", "no_mobile_phones", "do_not_litter", "non-potable_water", "no_bicycles", "no_pedestrians", "children_crossing", "no_entry", "eight_spoked_asterisk", "sparkle", "eight_pointed_black_star", "heart_decoration", "vs", "vibration_mode", "mobile_phone_off", "chart", "currency_exchange", "aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpius", "sagittarius", "capricorn", "aquarius", "pisces", "ophiuchus", "six_pointed_star", "negative_squared_cross_mark", "a", "b", "ab", "o2", "diamond_shape_with_a_dot_inside", "recycle", "end", "back", "on", "soon", "clock1", "clock130", "clock10", "clock1030", "clock11", "clock1130", "clock12", "clock1230", "clock2", "clock230", "clock3", "clock330", "clock4", "clock430", "clock5", "clock530", "clock6", "clock630", "clock7", "clock730", "clock8", "clock830", "clock9", "clock930", "heavy_dollar_sign", "copyright", "registered", "tm", "x", "heavy_exclamation_mark", "bangbang", "interrobang", "o", "heavy_multiplication_x", "heavy_plus_sign", "heavy_minus_sign", "heavy_division_sign", "white_flower", "100", "heavy_check_mark", "ballot_box_with_check", "radio_button", "link", "curly_loop", "wavy_dash", "part_alternation_mark", "trident", "black_small_square", "white_small_square", "black_medium_small_square", "white_medium_small_square", "black_medium_square", "white_medium_square", "black_large_square", "white_large_square", "white_check_mark", "black_square_button", "white_square_button", "black_circle", "white_circle", "red_circle", "large_blue_circle", "large_blue_diamond", "large_orange_diamond", "small_blue_diamond", "small_orange_diamond", "small_red_triangle", "small_red_triangle_down", "shipit"]
                },
                "twemoji": ["tw-1f004", "tw-1f0cf", "tw-1f170", "tw-1f171", "tw-1f17e", "tw-1f17f", "tw-1f18e", "tw-1f191", "tw-1f192", "tw-1f193", "tw-1f194", "tw-1f195", "tw-1f196", "tw-1f197", "tw-1f198", "tw-1f199", "tw-1f19a", "tw-1f1e6", "tw-1f1e7", "tw-1f1e8-1f1f3", "tw-1f1e8", "tw-1f1e9-1f1ea", "tw-1f1e9", "tw-1f1ea-1f1f8", "tw-1f1ea", "tw-1f1eb-1f1f7", "tw-1f1eb", "tw-1f1ec-1f1e7", "tw-1f1ec", "tw-1f1ed", "tw-1f1ee-1f1f9", "tw-1f1ee", "tw-1f1ef-1f1f5", "tw-1f1ef", "tw-1f1f0-1f1f7", "tw-1f1f0", "tw-1f1f1", "tw-1f1f2", "tw-1f1f3", "tw-1f1f4", "tw-1f1f5", "tw-1f1f6", "tw-1f1f7-1f1fa", "tw-1f1f7", "tw-1f1f8", "tw-1f1f9", "tw-1f1fa-1f1f8", "tw-1f1fa", "tw-1f1fb", "tw-1f1fc", "tw-1f1fd", "tw-1f1fe", "tw-1f1ff", "tw-1f201", "tw-1f202", "tw-1f21a", "tw-1f22f", "tw-1f232", "tw-1f233", "tw-1f234", "tw-1f235", "tw-1f236", "tw-1f237", "tw-1f238", "tw-1f239", "tw-1f23a", "tw-1f250", "tw-1f251", "tw-1f300", "tw-1f301", "tw-1f302", "tw-1f303", "tw-1f304", "tw-1f305", "tw-1f306", "tw-1f307", "tw-1f308", "tw-1f309", "tw-1f30a", "tw-1f30b", "tw-1f30c", "tw-1f30d", "tw-1f30e", "tw-1f30f", "tw-1f310", "tw-1f311", "tw-1f312", "tw-1f313", "tw-1f314", "tw-1f315", "tw-1f316", "tw-1f317", "tw-1f318", "tw-1f319", "tw-1f31a", "tw-1f31b", "tw-1f31c", "tw-1f31d", "tw-1f31e", "tw-1f31f", "tw-1f320", "tw-1f330", "tw-1f331", "tw-1f332", "tw-1f333", "tw-1f334", "tw-1f335", "tw-1f337", "tw-1f338", "tw-1f339", "tw-1f33a", "tw-1f33b", "tw-1f33c", "tw-1f33d", "tw-1f33e", "tw-1f33f", "tw-1f340", "tw-1f341", "tw-1f342", "tw-1f343", "tw-1f344", "tw-1f345", "tw-1f346", "tw-1f347", "tw-1f348", "tw-1f349", "tw-1f34a", "tw-1f34b", "tw-1f34c", "tw-1f34d", "tw-1f34e", "tw-1f34f", "tw-1f350", "tw-1f351", "tw-1f352", "tw-1f353", "tw-1f354", "tw-1f355", "tw-1f356", "tw-1f357", "tw-1f358", "tw-1f359", "tw-1f35a", "tw-1f35b", "tw-1f35c", "tw-1f35d", "tw-1f35e", "tw-1f35f", "tw-1f360", "tw-1f361", "tw-1f362", "tw-1f363", "tw-1f364", "tw-1f365", "tw-1f366", "tw-1f367", "tw-1f368", "tw-1f369", "tw-1f36a", "tw-1f36b", "tw-1f36c", "tw-1f36d", "tw-1f36e", "tw-1f36f", "tw-1f370", "tw-1f371", "tw-1f372", "tw-1f373", "tw-1f374", "tw-1f375", "tw-1f376", "tw-1f377", "tw-1f378", "tw-1f379", "tw-1f37a", "tw-1f37b", "tw-1f37c", "tw-1f380", "tw-1f381", "tw-1f382", "tw-1f383", "tw-1f384", "tw-1f385", "tw-1f386", "tw-1f387", "tw-1f388", "tw-1f389", "tw-1f38a", "tw-1f38b", "tw-1f38c", "tw-1f38d", "tw-1f38e", "tw-1f38f", "tw-1f390", "tw-1f391", "tw-1f392", "tw-1f393", "tw-1f3a0", "tw-1f3a1", "tw-1f3a2", "tw-1f3a3", "tw-1f3a4", "tw-1f3a5", "tw-1f3a6", "tw-1f3a7", "tw-1f3a8", "tw-1f3a9", "tw-1f3aa", "tw-1f3ab", "tw-1f3ac", "tw-1f3ad", "tw-1f3ae", "tw-1f3af", "tw-1f3b0", "tw-1f3b1", "tw-1f3b2", "tw-1f3b3", "tw-1f3b4", "tw-1f3b5", "tw-1f3b6", "tw-1f3b7", "tw-1f3b8", "tw-1f3b9", "tw-1f3ba", "tw-1f3bb", "tw-1f3bc", "tw-1f3bd", "tw-1f3be", "tw-1f3bf", "tw-1f3c0", "tw-1f3c1", "tw-1f3c2", "tw-1f3c3", "tw-1f3c4", "tw-1f3c6", "tw-1f3c7", "tw-1f3c8", "tw-1f3c9", "tw-1f3ca", "tw-1f3e0", "tw-1f3e1", "tw-1f3e2", "tw-1f3e3", "tw-1f3e4", "tw-1f3e5", "tw-1f3e6", "tw-1f3e7", "tw-1f3e8", "tw-1f3e9", "tw-1f3ea", "tw-1f3eb", "tw-1f3ec", "tw-1f3ed", "tw-1f3ee", "tw-1f3ef", "tw-1f3f0", "tw-1f400", "tw-1f401", "tw-1f402", "tw-1f403", "tw-1f404", "tw-1f405", "tw-1f406", "tw-1f407", "tw-1f408", "tw-1f409", "tw-1f40a", "tw-1f40b", "tw-1f40c", "tw-1f40d", "tw-1f40e", "tw-1f40f", "tw-1f410", "tw-1f411", "tw-1f412", "tw-1f413", "tw-1f414", "tw-1f415", "tw-1f416", "tw-1f417", "tw-1f418", "tw-1f419", "tw-1f41a", "tw-1f41b", "tw-1f41c", "tw-1f41d", "tw-1f41e", "tw-1f41f", "tw-1f420", "tw-1f421", "tw-1f422", "tw-1f423", "tw-1f424", "tw-1f425", "tw-1f426", "tw-1f427", "tw-1f428", "tw-1f429", "tw-1f42a", "tw-1f42b", "tw-1f42c", "tw-1f42d", "tw-1f42e", "tw-1f42f", "tw-1f430", "tw-1f431", "tw-1f432", "tw-1f433", "tw-1f434", "tw-1f435", "tw-1f436", "tw-1f437", "tw-1f438", "tw-1f439", "tw-1f43a", "tw-1f43b", "tw-1f43c", "tw-1f43d", "tw-1f43e", "tw-1f440", "tw-1f442", "tw-1f443", "tw-1f444", "tw-1f445", "tw-1f446", "tw-1f447", "tw-1f448", "tw-1f449", "tw-1f44a", "tw-1f44b", "tw-1f44c", "tw-1f44d", "tw-1f44e", "tw-1f44f", "tw-1f450", "tw-1f451", "tw-1f452", "tw-1f453", "tw-1f454", "tw-1f455", "tw-1f456", "tw-1f457", "tw-1f458", "tw-1f459", "tw-1f45a", "tw-1f45b", "tw-1f45c", "tw-1f45d", "tw-1f45e", "tw-1f45f", "tw-1f460", "tw-1f461", "tw-1f462", "tw-1f463", "tw-1f464", "tw-1f465", "tw-1f466", "tw-1f467", "tw-1f468", "tw-1f469", "tw-1f46a", "tw-1f46b", "tw-1f46c", "tw-1f46d", "tw-1f46e", "tw-1f46f", "tw-1f470", "tw-1f471", "tw-1f472", "tw-1f473", "tw-1f474", "tw-1f475", "tw-1f476", "tw-1f477", "tw-1f478", "tw-1f479", "tw-1f47a", "tw-1f47b", "tw-1f47c", "tw-1f47d", "tw-1f47e", "tw-1f47f", "tw-1f480", "tw-1f481", "tw-1f482", "tw-1f483", "tw-1f484", "tw-1f485", "tw-1f486", "tw-1f487", "tw-1f488", "tw-1f489", "tw-1f48a", "tw-1f48b", "tw-1f48c", "tw-1f48d", "tw-1f48e", "tw-1f48f", "tw-1f490", "tw-1f491", "tw-1f492", "tw-1f493", "tw-1f494", "tw-1f495", "tw-1f496", "tw-1f497", "tw-1f498", "tw-1f499", "tw-1f49a", "tw-1f49b", "tw-1f49c", "tw-1f49d", "tw-1f49e", "tw-1f49f", "tw-1f4a0", "tw-1f4a1", "tw-1f4a2", "tw-1f4a3", "tw-1f4a4", "tw-1f4a5", "tw-1f4a6", "tw-1f4a7", "tw-1f4a8", "tw-1f4a9", "tw-1f4aa", "tw-1f4ab", "tw-1f4ac", "tw-1f4ad", "tw-1f4ae", "tw-1f4af", "tw-1f4b0", "tw-1f4b1", "tw-1f4b2", "tw-1f4b3", "tw-1f4b4", "tw-1f4b5", "tw-1f4b6", "tw-1f4b7", "tw-1f4b8", "tw-1f4b9", "tw-1f4ba", "tw-1f4bb", "tw-1f4bc", "tw-1f4bd", "tw-1f4be", "tw-1f4bf", "tw-1f4c0", "tw-1f4c1", "tw-1f4c2", "tw-1f4c3", "tw-1f4c4", "tw-1f4c5", "tw-1f4c6", "tw-1f4c7", "tw-1f4c8", "tw-1f4c9", "tw-1f4ca", "tw-1f4cb", "tw-1f4cc", "tw-1f4cd", "tw-1f4ce", "tw-1f4cf", "tw-1f4d0", "tw-1f4d1", "tw-1f4d2", "tw-1f4d3", "tw-1f4d4", "tw-1f4d5", "tw-1f4d6", "tw-1f4d7", "tw-1f4d8", "tw-1f4d9", "tw-1f4da", "tw-1f4db", "tw-1f4dc", "tw-1f4dd", "tw-1f4de", "tw-1f4df", "tw-1f4e0", "tw-1f4e1", "tw-1f4e2", "tw-1f4e3", "tw-1f4e4", "tw-1f4e5", "tw-1f4e6", "tw-1f4e7", "tw-1f4e8", "tw-1f4e9", "tw-1f4ea", "tw-1f4eb", "tw-1f4ec", "tw-1f4ed", "tw-1f4ee", "tw-1f4ef", "tw-1f4f0", "tw-1f4f1", "tw-1f4f2", "tw-1f4f3", "tw-1f4f4", "tw-1f4f5", "tw-1f4f6", "tw-1f4f7", "tw-1f4f9", "tw-1f4fa", "tw-1f4fb", "tw-1f4fc", "tw-1f500", "tw-1f501", "tw-1f502", "tw-1f503", "tw-1f504", "tw-1f505", "tw-1f506", "tw-1f507", "tw-1f508", "tw-1f509", "tw-1f50a", "tw-1f50b", "tw-1f50c", "tw-1f50d", "tw-1f50e", "tw-1f50f", "tw-1f510", "tw-1f511", "tw-1f512", "tw-1f513", "tw-1f514", "tw-1f515", "tw-1f516", "tw-1f517", "tw-1f518", "tw-1f519", "tw-1f51a", "tw-1f51b", "tw-1f51c", "tw-1f51d", "tw-1f51e", "tw-1f51f", "tw-1f520", "tw-1f521", "tw-1f522", "tw-1f523", "tw-1f524", "tw-1f525", "tw-1f526", "tw-1f527", "tw-1f528", "tw-1f529", "tw-1f52a", "tw-1f52b", "tw-1f52c", "tw-1f52d", "tw-1f52e", "tw-1f52f", "tw-1f530", "tw-1f531", "tw-1f532", "tw-1f533", "tw-1f534", "tw-1f535", "tw-1f536", "tw-1f537", "tw-1f538", "tw-1f539", "tw-1f53a", "tw-1f53b", "tw-1f53c", "tw-1f53d", "tw-1f550", "tw-1f551", "tw-1f552", "tw-1f553", "tw-1f554", "tw-1f555", "tw-1f556", "tw-1f557", "tw-1f558", "tw-1f559", "tw-1f55a", "tw-1f55b", "tw-1f55c", "tw-1f55d", "tw-1f55e", "tw-1f55f", "tw-1f560", "tw-1f561", "tw-1f562", "tw-1f563", "tw-1f564", "tw-1f565", "tw-1f566", "tw-1f567", "tw-1f5fb", "tw-1f5fc", "tw-1f5fd", "tw-1f5fe", "tw-1f5ff", "tw-1f600", "tw-1f601", "tw-1f602", "tw-1f603", "tw-1f604", "tw-1f605", "tw-1f606", "tw-1f607", "tw-1f608", "tw-1f609", "tw-1f60a", "tw-1f60b", "tw-1f60c", "tw-1f60d", "tw-1f60e", "tw-1f60f", "tw-1f610", "tw-1f611", "tw-1f612", "tw-1f613", "tw-1f614", "tw-1f615", "tw-1f616", "tw-1f617", "tw-1f618", "tw-1f619", "tw-1f61a", "tw-1f61b", "tw-1f61c", "tw-1f61d", "tw-1f61e", "tw-1f61f", "tw-1f620", "tw-1f621", "tw-1f622", "tw-1f623", "tw-1f624", "tw-1f625", "tw-1f626", "tw-1f627", "tw-1f628", "tw-1f629", "tw-1f62a", "tw-1f62b", "tw-1f62c", "tw-1f62d", "tw-1f62e", "tw-1f62f", "tw-1f630", "tw-1f631", "tw-1f632", "tw-1f633", "tw-1f634", "tw-1f635", "tw-1f636", "tw-1f637", "tw-1f638", "tw-1f639", "tw-1f63a", "tw-1f63b", "tw-1f63c", "tw-1f63d", "tw-1f63e", "tw-1f63f", "tw-1f640", "tw-1f645", "tw-1f646", "tw-1f647", "tw-1f648", "tw-1f649", "tw-1f64a", "tw-1f64b", "tw-1f64c", "tw-1f64d", "tw-1f64e", "tw-1f64f", "tw-1f680", "tw-1f681", "tw-1f682", "tw-1f683", "tw-1f684", "tw-1f685", "tw-1f686", "tw-1f687", "tw-1f688", "tw-1f689", "tw-1f68a", "tw-1f68b", "tw-1f68c", "tw-1f68d", "tw-1f68e", "tw-1f68f", "tw-1f690", "tw-1f691", "tw-1f692", "tw-1f693", "tw-1f694", "tw-1f695", "tw-1f696", "tw-1f697", "tw-1f698", "tw-1f699", "tw-1f69a", "tw-1f69b", "tw-1f69c", "tw-1f69d", "tw-1f69e", "tw-1f69f", "tw-1f6a0", "tw-1f6a1", "tw-1f6a2", "tw-1f6a3", "tw-1f6a4", "tw-1f6a5", "tw-1f6a6", "tw-1f6a7", "tw-1f6a8", "tw-1f6a9", "tw-1f6aa", "tw-1f6ab", "tw-1f6ac", "tw-1f6ad", "tw-1f6ae", "tw-1f6af", "tw-1f6b0", "tw-1f6b1", "tw-1f6b2", "tw-1f6b3", "tw-1f6b4", "tw-1f6b5", "tw-1f6b6", "tw-1f6b7", "tw-1f6b8", "tw-1f6b9", "tw-1f6ba", "tw-1f6bb", "tw-1f6bc", "tw-1f6bd", "tw-1f6be", "tw-1f6bf", "tw-1f6c0", "tw-1f6c1", "tw-1f6c2", "tw-1f6c3", "tw-1f6c4", "tw-1f6c5", "tw-203c", "tw-2049", "tw-2122", "tw-2139", "tw-2194", "tw-2195", "tw-2196", "tw-2197", "tw-2198", "tw-2199", "tw-21a9", "tw-21aa", "tw-23-20e3", "tw-231a", "tw-231b", "tw-23e9", "tw-23ea", "tw-23eb", "tw-23ec", "tw-23f0", "tw-23f3", "tw-24c2", "tw-25aa", "tw-25ab", "tw-25b6", "tw-25c0", "tw-25fb", "tw-25fc", "tw-25fd", "tw-25fe", "tw-2600", "tw-2601", "tw-260e", "tw-2611", "tw-2614", "tw-2615", "tw-261d", "tw-263a", "tw-2648", "tw-2649", "tw-264a", "tw-264b", "tw-264c", "tw-264d", "tw-264e", "tw-264f", "tw-2650", "tw-2651", "tw-2652", "tw-2653", "tw-2660", "tw-2663", "tw-2665", "tw-2666", "tw-2668", "tw-267b", "tw-267f", "tw-2693", "tw-26a0", "tw-26a1", "tw-26aa", "tw-26ab", "tw-26bd", "tw-26be", "tw-26c4", "tw-26c5", "tw-26ce", "tw-26d4", "tw-26ea", "tw-26f2", "tw-26f3", "tw-26f5", "tw-26fa", "tw-26fd", "tw-2702", "tw-2705", "tw-2708", "tw-2709", "tw-270a", "tw-270b", "tw-270c", "tw-270f", "tw-2712", "tw-2714", "tw-2716", "tw-2728", "tw-2733", "tw-2734", "tw-2744", "tw-2747", "tw-274c", "tw-274e", "tw-2753", "tw-2754", "tw-2755", "tw-2757", "tw-2764", "tw-2795", "tw-2796", "tw-2797", "tw-27a1", "tw-27b0", "tw-27bf", "tw-2934", "tw-2935", "tw-2b05", "tw-2b06", "tw-2b07", "tw-2b1b", "tw-2b1c", "tw-2b50", "tw-2b55", "tw-30-20e3", "tw-3030", "tw-303d", "tw-31-20e3", "tw-32-20e3", "tw-3297", "tw-3299", "tw-33-20e3", "tw-34-20e3", "tw-35-20e3", "tw-36-20e3", "tw-37-20e3", "tw-38-20e3", "tw-39-20e3", "tw-a9", "tw-ae", "tw-e50a"],
                "font-awesome": ["fa-glass", "fa-music", "fa-search", "fa-envelope-o", "fa-heart", "fa-star", "fa-star-o", "fa-user", "fa-film", "fa-th-large", "fa-th", "fa-th-list", "fa-check", "fa-times", "fa-search-plus", "fa-search-minus", "fa-power-off", "fa-signal", "fa-cog", "fa-trash-o", "fa-home", "fa-file-o", "fa-clock-o", "fa-road", "fa-download", "fa-arrow-circle-o-down", "fa-arrow-circle-o-up", "fa-inbox", "fa-play-circle-o", "fa-repeat", "fa-refresh", "fa-list-alt", "fa-lock", "fa-flag", "fa-headphones", "fa-volume-off", "fa-volume-down", "fa-volume-up", "fa-qrcode", "fa-barcode", "fa-tag", "fa-tags", "fa-book", "fa-bookmark", "fa-print", "fa-camera", "fa-font", "fa-bold", "fa-italic", "fa-text-height", "fa-text-width", "fa-align-left", "fa-align-center", "fa-align-right", "fa-align-justify", "fa-list", "fa-outdent", "fa-indent", "fa-video-camera", "fa-picture-o", "fa-pencil", "fa-map-marker", "fa-adjust", "fa-tint", "fa-pencil-square-o", "fa-share-square-o", "fa-check-square-o", "fa-arrows", "fa-step-backward", "fa-fast-backward", "fa-backward", "fa-play", "fa-pause", "fa-stop", "fa-forward", "fa-fast-forward", "fa-step-forward", "fa-eject", "fa-chevron-left", "fa-chevron-right", "fa-plus-circle", "fa-minus-circle", "fa-times-circle", "fa-check-circle", "fa-question-circle", "fa-info-circle", "fa-crosshairs", "fa-times-circle-o", "fa-check-circle-o", "fa-ban", "fa-arrow-left", "fa-arrow-right", "fa-arrow-up", "fa-arrow-down", "fa-share", "fa-expand", "fa-compress", "fa-plus", "fa-minus", "fa-asterisk", "fa-exclamation-circle", "fa-gift", "fa-leaf", "fa-fire", "fa-eye", "fa-eye-slash", "fa-exclamation-triangle", "fa-plane", "fa-calendar", "fa-random", "fa-comment", "fa-magnet", "fa-chevron-up", "fa-chevron-down", "fa-retweet", "fa-shopping-cart", "fa-folder", "fa-folder-open", "fa-arrows-v", "fa-arrows-h", "fa-bar-chart", "fa-twitter-square", "fa-facebook-square", "fa-camera-retro", "fa-key", "fa-cogs", "fa-comments", "fa-thumbs-o-up", "fa-thumbs-o-down", "fa-star-half", "fa-heart-o", "fa-sign-out", "fa-linkedin-square", "fa-thumb-tack", "fa-external-link", "fa-sign-in", "fa-trophy", "fa-github-square", "fa-upload", "fa-lemon-o", "fa-phone", "fa-square-o", "fa-bookmark-o", "fa-phone-square", "fa-twitter", "fa-facebook", "fa-github", "fa-unlock", "fa-credit-card", "fa-rss", "fa-hdd-o", "fa-bullhorn", "fa-bell", "fa-certificate", "fa-hand-o-right", "fa-hand-o-left", "fa-hand-o-up", "fa-hand-o-down", "fa-arrow-circle-left", "fa-arrow-circle-right", "fa-arrow-circle-up", "fa-arrow-circle-down", "fa-globe", "fa-wrench", "fa-tasks", "fa-filter", "fa-briefcase", "fa-arrows-alt", "fa-users", "fa-link", "fa-cloud", "fa-flask", "fa-scissors", "fa-files-o", "fa-paperclip", "fa-floppy-o", "fa-square", "fa-bars", "fa-list-ul", "fa-list-ol", "fa-strikethrough", "fa-underline", "fa-table", "fa-magic", "fa-truck", "fa-pinterest", "fa-pinterest-square", "fa-google-plus-square", "fa-google-plus", "fa-money", "fa-caret-down", "fa-caret-up", "fa-caret-left", "fa-caret-right", "fa-columns", "fa-sort", "fa-sort-desc", "fa-sort-asc", "fa-envelope", "fa-linkedin", "fa-undo", "fa-gavel", "fa-tachometer", "fa-comment-o", "fa-comments-o", "fa-bolt", "fa-sitemap", "fa-umbrella", "fa-clipboard", "fa-lightbulb-o", "fa-exchange", "fa-cloud-download", "fa-cloud-upload", "fa-user-md", "fa-stethoscope", "fa-suitcase", "fa-bell-o", "fa-coffee", "fa-cutlery", "fa-file-text-o", "fa-building-o", "fa-hospital-o", "fa-ambulance", "fa-medkit", "fa-fighter-jet", "fa-beer", "fa-h-square", "fa-plus-square", "fa-angle-double-left", "fa-angle-double-right", "fa-angle-double-up", "fa-angle-double-down", "fa-angle-left", "fa-angle-right", "fa-angle-up", "fa-angle-down", "fa-desktop", "fa-laptop", "fa-tablet", "fa-mobile", "fa-circle-o", "fa-quote-left", "fa-quote-right", "fa-spinner", "fa-circle", "fa-reply", "fa-github-alt", "fa-folder-o", "fa-folder-open-o", "fa-smile-o", "fa-frown-o", "fa-meh-o", "fa-gamepad", "fa-keyboard-o", "fa-flag-o", "fa-flag-checkered", "fa-terminal", "fa-code", "fa-reply-all", "fa-star-half-o", "fa-location-arrow", "fa-crop", "fa-code-fork", "fa-chain-broken", "fa-question", "fa-info", "fa-exclamation", "fa-superscript", "fa-subscript", "fa-eraser", "fa-puzzle-piece", "fa-microphone", "fa-microphone-slash", "fa-shield", "fa-calendar-o", "fa-fire-extinguisher", "fa-rocket", "fa-maxcdn", "fa-chevron-circle-left", "fa-chevron-circle-right", "fa-chevron-circle-up", "fa-chevron-circle-down", "fa-html5", "fa-css3", "fa-anchor", "fa-unlock-alt", "fa-bullseye", "fa-ellipsis-h", "fa-ellipsis-v", "fa-rss-square", "fa-play-circle", "fa-ticket", "fa-minus-square", "fa-minus-square-o", "fa-level-up", "fa-level-down", "fa-check-square", "fa-pencil-square", "fa-share-square", "fa-compass", "fa-caret-square-o-down", "fa-caret-square-o-up", "fa-caret-square-o-right", "fa-eur", "fa-gbp", "fa-usd", "fa-inr", "fa-jpy", "fa-rub", "fa-krw", "fa-btc", "fa-file", "fa-file-text", "fa-sort-alpha-asc", "fa-sort-alpha-desc", "fa-sort-amount-asc", "fa-sort-amount-desc", "fa-sort-numeric-asc", "fa-sort-numeric-desc", "fa-thumbs-up", "fa-thumbs-down", "fa-youtube-square", "fa-youtube", "fa-xing", "fa-xing-square", "fa-youtube-play", "fa-dropbox", "fa-stack-overflow", "fa-instagram", "fa-flickr", "fa-adn", "fa-bitbucket", "fa-bitbucket-square", "fa-tumblr", "fa-tumblr-square", "fa-long-arrow-down", "fa-long-arrow-up", "fa-long-arrow-left", "fa-long-arrow-right", "fa-apple", "fa-windows", "fa-android", "fa-linux", "fa-dribbble", "fa-skype", "fa-foursquare", "fa-trello", "fa-female", "fa-male", "fa-gratipay", "fa-sun-o", "fa-moon-o", "fa-archive", "fa-bug", "fa-vk", "fa-weibo", "fa-renren", "fa-pagelines", "fa-stack-exchange", "fa-arrow-circle-o-right", "fa-arrow-circle-o-left", "fa-caret-square-o-left", "fa-dot-circle-o", "fa-wheelchair", "fa-vimeo-square", "fa-try", "fa-plus-square-o", "fa-space-shuttle", "fa-slack", "fa-envelope-square", "fa-wordpress", "fa-openid", "fa-university", "fa-graduation-cap", "fa-yahoo", "fa-google", "fa-reddit", "fa-reddit-square", "fa-stumbleupon-circle", "fa-stumbleupon", "fa-delicious", "fa-digg", "fa-pied-piper", "fa-pied-piper-alt", "fa-drupal", "fa-joomla", "fa-language", "fa-fax", "fa-building", "fa-child", "fa-paw", "fa-spoon", "fa-cube", "fa-cubes", "fa-behance", "fa-behance-square", "fa-steam", "fa-steam-square", "fa-recycle", "fa-car", "fa-taxi", "fa-tree", "fa-spotify", "fa-deviantart", "fa-soundcloud", "fa-database", "fa-file-pdf-o", "fa-file-word-o", "fa-file-excel-o", "fa-file-powerpoint-o", "fa-file-image-o", "fa-file-archive-o", "fa-file-audio-o", "fa-file-video-o", "fa-file-code-o", "fa-vine", "fa-codepen", "fa-jsfiddle", "fa-life-ring", "fa-circle-o-notch", "fa-rebel", "fa-empire", "fa-git-square", "fa-git", "fa-hacker-news", "fa-tencent-weibo", "fa-qq", "fa-weixin", "fa-paper-plane", "fa-paper-plane-o", "fa-history", "fa-circle-thin", "fa-header", "fa-paragraph", "fa-sliders", "fa-share-alt", "fa-share-alt-square", "fa-bomb", "fa-futbol-o", "fa-tty", "fa-binoculars", "fa-plug", "fa-slideshare", "fa-twitch", "fa-yelp", "fa-newspaper-o", "fa-wifi", "fa-calculator", "fa-paypal", "fa-google-wallet", "fa-cc-visa", "fa-cc-mastercard", "fa-cc-discover", "fa-cc-amex", "fa-cc-paypal", "fa-cc-stripe", "fa-bell-slash", "fa-bell-slash-o", "fa-trash", "fa-copyright", "fa-at", "fa-eyedropper", "fa-paint-brush", "fa-birthday-cake", "fa-area-chart", "fa-pie-chart", "fa-line-chart", "fa-lastfm", "fa-lastfm-square", "fa-toggle-off", "fa-toggle-on", "fa-bicycle", "fa-bus", "fa-ioxhost", "fa-angellist", "fa-cc", "fa-ils", "fa-meanpath", "fa-buysellads", "fa-connectdevelop", "fa-dashcube", "fa-forumbee", "fa-leanpub", "fa-sellsy", "fa-shirtsinbulk", "fa-simplybuilt", "fa-skyatlas", "fa-cart-plus", "fa-cart-arrow-down", "fa-diamond", "fa-ship", "fa-user-secret", "fa-motorcycle", "fa-street-view", "fa-heartbeat", "fa-venus", "fa-mars", "fa-mercury", "fa-transgender", "fa-transgender-alt", "fa-venus-double", "fa-mars-double", "fa-venus-mars", "fa-mars-stroke", "fa-mars-stroke-v", "fa-mars-stroke-h", "fa-neuter", "fa-facebook-official", "fa-pinterest-p", "fa-whatsapp", "fa-server", "fa-user-plus", "fa-user-times", "fa-bed", "fa-viacoin", "fa-train", "fa-subway", "fa-medium", "fa-GitHub", "fa-bed", "fa-buysellads", "fa-cart-arrow-down", "fa-cart-plus", "fa-connectdevelop", "fa-dashcube", "fa-diamond", "fa-facebook-official", "fa-forumbee", "fa-heartbeat", "fa-hotel", "fa-leanpub", "fa-mars", "fa-mars-double", "fa-mars-stroke", "fa-mars-stroke-h", "fa-mars-stroke-v", "fa-medium", "fa-mercury", "fa-motorcycle", "fa-neuter", "fa-pinterest-p", "fa-sellsy", "fa-server", "fa-ship", "fa-shirtsinbulk", "fa-simplybuilt", "fa-skyatlas", "fa-street-view", "fa-subway", "fa-train", "fa-transgender", "fa-transgender-alt", "fa-user-plus", "fa-user-secret", "fa-user-times", "fa-venus", "fa-venus-double", "fa-venus-mars", "fa-viacoin", "fa-whatsapp", "fa-adjust", "fa-anchor", "fa-archive", "fa-area-chart", "fa-arrows", "fa-arrows-h", "fa-arrows-v", "fa-asterisk", "fa-at", "fa-automobile", "fa-ban", "fa-bank", "fa-bar-chart", "fa-bar-chart-o", "fa-barcode", "fa-bars", "fa-bed", "fa-beer", "fa-bell", "fa-bell-o", "fa-bell-slash", "fa-bell-slash-o", "fa-bicycle", "fa-binoculars", "fa-birthday-cake", "fa-bolt", "fa-bomb", "fa-book", "fa-bookmark", "fa-bookmark-o", "fa-briefcase", "fa-bug", "fa-building", "fa-building-o", "fa-bullhorn", "fa-bullseye", "fa-bus", "fa-cab", "fa-calculator", "fa-calendar", "fa-calendar-o", "fa-camera", "fa-camera-retro", "fa-car", "fa-caret-square-o-down", "fa-caret-square-o-left", "fa-caret-square-o-right", "fa-caret-square-o-up", "fa-cart-arrow-down", "fa-cart-plus", "fa-cc", "fa-certificate", "fa-check", "fa-check-circle", "fa-check-circle-o", "fa-check-square", "fa-check-square-o", "fa-child", "fa-circle", "fa-circle-o", "fa-circle-o-notch", "fa-circle-thin", "fa-clock-o", "fa-close", "fa-cloud", "fa-cloud-download", "fa-cloud-upload", "fa-code", "fa-code-fork", "fa-coffee", "fa-cog", "fa-cogs", "fa-comment", "fa-comment-o", "fa-comments", "fa-comments-o", "fa-compass", "fa-copyright", "fa-credit-card", "fa-crop", "fa-crosshairs", "fa-cube", "fa-cubes", "fa-cutlery", "fa-dashboard", "fa-database", "fa-desktop", "fa-diamond", "fa-dot-circle-o", "fa-download", "fa-edit", "fa-ellipsis-h", "fa-ellipsis-v", "fa-envelope", "fa-envelope-o", "fa-envelope-square", "fa-eraser", "fa-exchange", "fa-exclamation", "fa-exclamation-circle", "fa-exclamation-triangle", "fa-external-link", "fa-external-link-square", "fa-eye", "fa-eye-slash", "fa-eyedropper", "fa-fax", "fa-female", "fa-fighter-jet", "fa-file-archive-o", "fa-file-audio-o", "fa-file-code-o", "fa-file-excel-o", "fa-file-image-o", "fa-file-movie-o", "fa-file-pdf-o", "fa-file-photo-o", "fa-file-picture-o", "fa-file-powerpoint-o", "fa-file-sound-o", "fa-file-video-o", "fa-file-word-o", "fa-file-zip-o", "fa-film", "fa-filter", "fa-fire", "fa-fire-extinguisher", "fa-flag", "fa-flag-checkered", "fa-flag-o", "fa-flash", "fa-flask", "fa-folder", "fa-folder-o", "fa-folder-open", "fa-folder-open-o", "fa-frown-o", "fa-futbol-o", "fa-gamepad", "fa-gavel", "fa-gear", "fa-gears", "fa-genderless", "fa-gift", "fa-glass", "fa-globe", "fa-graduation-cap", "fa-group", "fa-hdd-o", "fa-headphones", "fa-heart", "fa-heart-o", "fa-heartbeat", "fa-history", "fa-home", "fa-hotel", "fa-image", "fa-inbox", "fa-info", "fa-info-circle", "fa-institution", "fa-key", "fa-keyboard-o", "fa-language", "fa-laptop", "fa-leaf", "fa-legal", "fa-lemon-o", "fa-level-down", "fa-level-up", "fa-life-bouy", "fa-life-buoy", "fa-life-ring", "fa-life-saver", "fa-lightbulb-o", "fa-line-chart", "fa-location-arrow", "fa-lock", "fa-magic", "fa-magnet", "fa-mail-forward", "fa-mail-reply", "fa-mail-reply-all", "fa-male", "fa-map-marker", "fa-meh-o", "fa-microphone", "fa-microphone-slash", "fa-minus", "fa-minus-circle", "fa-minus-square", "fa-minus-square-o", "fa-mobile", "fa-mobile-phone", "fa-money", "fa-moon-o", "fa-mortar-board", "fa-motorcycle", "fa-music", "fa-navicon", "fa-newspaper-o", "fa-paint-brush", "fa-paper-plane", "fa-paper-plane-o", "fa-paw", "fa-pencil", "fa-pencil-square", "fa-pencil-square-o", "fa-phone", "fa-phone-square", "fa-photo", "fa-picture-o", "fa-pie-chart", "fa-plane", "fa-plug", "fa-plus", "fa-plus-circle", "fa-plus-square", "fa-plus-square-o", "fa-power-off", "fa-print", "fa-puzzle-piece", "fa-qrcode", "fa-question", "fa-question-circle", "fa-quote-left", "fa-quote-right", "fa-random", "fa-recycle", "fa-refresh", "fa-remove", "fa-reorder", "fa-reply", "fa-reply-all", "fa-retweet", "fa-road", "fa-rocket", "fa-rss", "fa-rss-square", "fa-search", "fa-search-minus", "fa-search-plus", "fa-send", "fa-send-o", "fa-server", "fa-share", "fa-share-alt", "fa-share-alt-square", "fa-share-square", "fa-share-square-o", "fa-shield", "fa-ship", "fa-shopping-cart", "fa-sign-in", "fa-sign-out", "fa-signal", "fa-sitemap", "fa-sliders", "fa-smile-o", "fa-soccer-ball-o", "fa-sort", "fa-sort-alpha-asc", "fa-sort-alpha-desc", "fa-sort-amount-asc", "fa-sort-amount-desc", "fa-sort-asc", "fa-sort-desc", "fa-sort-down", "fa-sort-numeric-asc", "fa-sort-numeric-desc", "fa-sort-up", "fa-space-shuttle", "fa-spinner", "fa-spoon", "fa-square", "fa-square-o", "fa-star", "fa-star-half", "fa-star-half-empty", "fa-star-half-full", "fa-star-half-o", "fa-star-o", "fa-street-view", "fa-suitcase", "fa-sun-o", "fa-support", "fa-tablet", "fa-tachometer", "fa-tag", "fa-tags", "fa-tasks", "fa-taxi", "fa-terminal", "fa-thumb-tack", "fa-thumbs-down", "fa-thumbs-o-down", "fa-thumbs-o-up", "fa-thumbs-up", "fa-ticket", "fa-times", "fa-times-circle", "fa-times-circle-o", "fa-tint", "fa-toggle-down", "fa-toggle-left", "fa-toggle-off", "fa-toggle-on", "fa-toggle-right", "fa-toggle-up", "fa-trash", "fa-trash-o", "fa-tree", "fa-trophy", "fa-truck", "fa-tty", "fa-umbrella", "fa-university", "fa-unlock", "fa-unlock-alt", "fa-unsorted", "fa-upload", "fa-user", "fa-user-plus", "fa-user-secret", "fa-user-times", "fa-users", "fa-video-camera", "fa-volume-down", "fa-volume-off", "fa-volume-up", "fa-warning", "fa-wheelchair", "fa-wifi", "fa-wrench", "fa-ambulance", "fa-automobile", "fa-bicycle", "fa-bus", "fa-cab", "fa-car", "fa-fighter-jet", "fa-motorcycle", "fa-plane", "fa-rocket", "fa-ship", "fa-space-shuttle", "fa-subway", "fa-taxi", "fa-train", "fa-truck", "fa-wheelchair", "fa-circle-thin", "fa-genderless", "fa-mars", "fa-mars-double", "fa-mars-stroke", "fa-mars-stroke-h", "fa-mars-stroke-v", "fa-mercury", "fa-neuter", "fa-transgender", "fa-transgender-alt", "fa-venus", "fa-venus-double", "fa-venus-mars", "fa-file", "fa-file-archive-o", "fa-file-audio-o", "fa-file-code-o", "fa-file-excel-o", "fa-file-image-o", "fa-file-movie-o", "fa-file-o", "fa-file-pdf-o", "fa-file-photo-o", "fa-file-picture-o", "fa-file-powerpoint-o", "fa-file-sound-o", "fa-file-text", "fa-file-text-o", "fa-file-video-o", "fa-file-word-o", "fa-file-zip-o", "fa-circle-o-notch", "fa-cog", "fa-gear", "fa-refresh", "fa-spinner", "fa-check-square", "fa-check-square-o", "fa-circle", "fa-circle-o", "fa-dot-circle-o", "fa-minus-square", "fa-minus-square-o", "fa-plus-square", "fa-plus-square-o", "fa-square", "fa-square-o", "fa-cc-amex", "fa-cc-discover", "fa-cc-mastercard", "fa-cc-paypal", "fa-cc-stripe", "fa-cc-visa", "fa-credit-card", "fa-google-wallet", "fa-paypal", "fa-area-chart", "fa-bar-chart", "fa-bar-chart-o", "fa-line-chart", "fa-pie-chart", "fa-bitcoin", "fa-btc", "fa-cny", "fa-dollar", "fa-eur", "fa-euro", "fa-gbp", "fa-ils", "fa-inr", "fa-jpy", "fa-krw", "fa-money", "fa-rmb", "fa-rouble", "fa-rub", "fa-ruble", "fa-rupee", "fa-shekel", "fa-sheqel", "fa-try", "fa-turkish-lira", "fa-usd", "fa-won", "fa-yen", "fa-align-center", "fa-align-justify", "fa-align-left", "fa-align-right", "fa-bold", "fa-chain", "fa-chain-broken", "fa-clipboard", "fa-columns", "fa-copy", "fa-cut", "fa-dedent", "fa-eraser", "fa-file", "fa-file-o", "fa-file-text", "fa-file-text-o", "fa-files-o", "fa-floppy-o", "fa-font", "fa-header", "fa-indent", "fa-italic", "fa-link", "fa-list", "fa-list-alt", "fa-list-ol", "fa-list-ul", "fa-outdent", "fa-paperclip", "fa-paragraph", "fa-paste", "fa-repeat", "fa-rotate-left", "fa-rotate-right", "fa-save", "fa-scissors", "fa-strikethrough", "fa-subscript", "fa-superscript", "fa-table", "fa-text-height", "fa-text-width", "fa-th", "fa-th-large", "fa-th-list", "fa-underline", "fa-undo", "fa-unlink", "fa-angle-double-down", "fa-angle-double-left", "fa-angle-double-right", "fa-angle-double-up", "fa-angle-down", "fa-angle-left", "fa-angle-right", "fa-angle-up", "fa-arrow-circle-down", "fa-arrow-circle-left", "fa-arrow-circle-o-down", "fa-arrow-circle-o-left", "fa-arrow-circle-o-right", "fa-arrow-circle-o-up", "fa-arrow-circle-right", "fa-arrow-circle-up", "fa-arrow-down", "fa-arrow-left", "fa-arrow-right", "fa-arrow-up", "fa-arrows", "fa-arrows-alt", "fa-arrows-h", "fa-arrows-v", "fa-caret-down", "fa-caret-left", "fa-caret-right", "fa-caret-square-o-down", "fa-caret-square-o-left", "fa-caret-square-o-right", "fa-caret-square-o-up", "fa-caret-up", "fa-chevron-circle-down", "fa-chevron-circle-left", "fa-chevron-circle-right", "fa-chevron-circle-up", "fa-chevron-down", "fa-chevron-left", "fa-chevron-right", "fa-chevron-up", "fa-hand-o-down", "fa-hand-o-left", "fa-hand-o-right", "fa-hand-o-up", "fa-long-arrow-down", "fa-long-arrow-left", "fa-long-arrow-right", "fa-long-arrow-up", "fa-toggle-down", "fa-toggle-left", "fa-toggle-right", "fa-toggle-up", "fa-arrows-alt", "fa-backward", "fa-compress", "fa-eject", "fa-expand", "fa-fast-backward", "fa-fast-forward", "fa-forward", "fa-pause", "fa-play", "fa-play-circle", "fa-play-circle-o", "fa-step-backward", "fa-step-forward", "fa-stop", "fa-youtube-play", "fa-report", "fa-adn", "fa-android", "fa-angellist", "fa-apple", "fa-behance", "fa-behance-square", "fa-bitbucket", "fa-bitbucket-square", "fa-bitcoin", "fa-btc", "fa-buysellads", "fa-cc-amex", "fa-cc-discover", "fa-cc-mastercard", "fa-cc-paypal", "fa-cc-stripe", "fa-cc-visa", "fa-codepen", "fa-connectdevelop", "fa-css3", "fa-dashcube", "fa-delicious", "fa-deviantart", "fa-digg", "fa-dribbble", "fa-dropbox", "fa-drupal", "fa-empire", "fa-facebook", "fa-facebook-f", "fa-facebook-official", "fa-facebook-square", "fa-flickr", "fa-forumbee", "fa-foursquare", "fa-ge", "fa-git", "fa-git-square", "fa-github", "fa-github-alt", "fa-github-square", "fa-gittip", "fa-google", "fa-google-plus", "fa-google-plus-square", "fa-google-wallet", "fa-gratipay", "fa-hacker-news", "fa-html5", "fa-instagram", "fa-ioxhost", "fa-joomla", "fa-jsfiddle", "fa-lastfm", "fa-lastfm-square", "fa-leanpub", "fa-linkedin", "fa-linkedin-square", "fa-linux", "fa-maxcdn", "fa-meanpath", "fa-medium", "fa-openid", "fa-pagelines", "fa-paypal", "fa-pied-piper", "fa-pied-piper-alt", "fa-pinterest", "fa-pinterest-p", "fa-pinterest-square", "fa-qq", "fa-ra", "fa-rebel", "fa-reddit", "fa-reddit-square", "fa-renren", "fa-sellsy", "fa-share-alt", "fa-share-alt-square", "fa-shirtsinbulk", "fa-simplybuilt", "fa-skyatlas", "fa-skype", "fa-slack", "fa-slideshare", "fa-soundcloud", "fa-spotify", "fa-stack-exchange", "fa-stack-overflow", "fa-steam", "fa-steam-square", "fa-stumbleupon", "fa-stumbleupon-circle", "fa-tencent-weibo", "fa-trello", "fa-tumblr", "fa-tumblr-square", "fa-twitch", "fa-twitter", "fa-twitter-square", "fa-viacoin", "fa-vimeo-square", "fa-vine", "fa-vk", "fa-wechat", "fa-weibo", "fa-weixin", "fa-whatsapp", "fa-windows", "fa-wordpress", "fa-xing", "fa-xing-square", "fa-yahoo", "fa-yelp", "fa-youtube", "fa-youtube-play", "fa-youtube-square", "fa-ambulance", "fa-h-square", "fa-heart", "fa-heart-o", "fa-heartbeat", "fa-hospital-o", "fa-medkit", "fa-plus-square", "fa-stethoscope", "fa-user-md", "fa-wheelchair"]
            }
        };

        // Class Properties
        this.$ns = 'bootstrap-markdown';
        this.$element = $(element);
        this.$editable = {el: null, type: null, attrKeys: [], attrValues: [], content: null};
        this.$options = $.extend(true, {}, $.fn.markdown.defaults, options, this.$element.data('options'));
        this.$oldContent = null;
        this.$isPreview = false;
        this.$isFullscreen = false;
        this.$editor = null;
        //add by wpl show markdown preview
        this.$fullscreenControls = false;
        //id
        this.$localStorage = options.localStorage;

        this.$uploadMode = false;
        this.$fullPreview = null;
        this.$innerPreview = null;
        this.$uploadPanel = null;
        this.$inputFile = null;
        this.$stateBar = null;
        this.$cutPaste = null;
        //上传进度条
        this.$progress = null;
        this.$percent = null;
        //上传文件限制512kb
        this.$fileSize = 524288;
        //registe
        this.$registPaste = false;
        //end
        this.$textarea = null;
        this.$handler = [];
        this.$callback = [];
        this.$nextTab = [];

        this.$emojiPanel = null;
        this.$emojiElements = null;

        this.showEditor();
    };

    Markdown.prototype = {

        constructor: Markdown

        , __alterButtons: function (name, alter) {
            var handler = this.$handler, isAll = (name == 'all'), that = this;

            $.each(handler, function (k, v) {
                var halt = true;
                if (isAll) {
                    halt = false;
                } else {
                    halt = v.indexOf(name) < 0;
                }

                if (halt === false) {
                    alter(that.$editor.find('button[data-handler="' + v + '"]'));
                }
            });
        }

        , __buildButtons: function (buttonsArray, container) {
            var i,
                ns = this.$ns,
                handler = this.$handler,
                callback = this.$callback;

            for (i = 0; i < buttonsArray.length; i++) {
                // Build each group container
                var y, btnGroups = buttonsArray[i];
                for (y = 0; y < btnGroups.length; y++) {
                    // Build each button group
                    var z,
                        buttons = btnGroups[y].data,
                        btnGroupContainer = $('<div/>', {
                            'class': 'btn-group'
                        });

                    for (z = 0; z < buttons.length; z++) {
                        var button = buttons[z],
                            buttonContainer, buttonIconContainer,
                            buttonHandler = ns + '-' + button.name,
                            buttonIcon = this.__getIcon(button.icon),
                            btnText = button.btnText ? button.btnText : '',
                        //btnClass = button.btnClass ? button.btnClass : 'btn',
                            tabIndex = button.tabIndex ? button.tabIndex : '-1',
                            hotkey = typeof button.hotkey !== 'undefined' ? button.hotkey : '',
                            hotkeyCaption = typeof jQuery.hotkeys !== 'undefined' && hotkey !== '' ? ' (' + hotkey + ')' : '';

                        // Construct the button object
                        buttonContainer = $('<button></button>');
                        /*buttonContainer.text(' ' + this.__localize(btnText)).addClass('btn-default btn-sm').addClass(btnClass);
                         if (btnClass.match(/btn\-(primary|success|info|warning|danger|link)/)) {
                         buttonContainer.removeClass('btn-default');
                         }*/
                        buttonContainer.attr({
                            'type': 'button',
                            'title': this.__localize(button.title) + hotkeyCaption,
                            'tabindex': tabIndex,
                            'data-provider': ns,
                            'data-handler': buttonHandler,
                            'data-hotkey': hotkey
                        });
                        if (button.toggle === true) {
                            buttonContainer.attr('data-toggle', 'button');
                        }
                        buttonIconContainer = $('<span/>');
                        buttonIconContainer.addClass(buttonIcon);
                        buttonIconContainer.prependTo(buttonContainer);

                        // Attach the button object
                        btnGroupContainer.append(buttonContainer);

                        // Register handler and callback
                        handler.push(buttonHandler);
                        callback.push(button.callback);
                    }

                    // Attach the button group into container dom
                    container.append(btnGroupContainer);
                }
            }

            return container;
        }
        , __setListener: function () {
            // Set size and resizable Properties
            var hasRows = typeof this.$textarea.attr('rows') !== 'undefined',
                maxRows = this.$textarea.val().split("\n").length > 5 ? this.$textarea.val().split("\n").length : '5',
                rowsVal = hasRows ? this.$textarea.attr('rows') : maxRows;

            this.$textarea.attr('rows', rowsVal);
            if (this.$options.resize) {
                this.$textarea.css('resize', this.$options.resize);
            }

            this.$textarea
                .on('focus', $.proxy(this.focus, this))
                .on('keypress', $.proxy(this.keypress, this))
                .on('keyup', $.proxy(this.keyup, this))
                .on('change', $.proxy(this.change, this));

            if (this.eventSupported('keydown')) {
                this.$textarea.on('keydown', $.proxy(this.keydown, this));
            }

            // Re-attach markdown data
            this.$textarea.data('markdown', this);
        }

        , __handle: function (e) {
            var target = $(e.currentTarget),
                handler = this.$handler,
                callback = this.$callback,
                handlerName = target.attr('data-handler'),
                callbackIndex = handler.indexOf(handlerName),
                callbackHandler = callback[callbackIndex];

            // Trigger the focusin
            $(e.currentTarget).focus();

            callbackHandler(this);

            // Trigger onChange for each button handle
            this.change(this);

            // Unless it was the save handler,
            // focusin the textarea
            if (handlerName.indexOf('cmdSave') < 0) {
                this.$textarea.focus();
            }

            e.preventDefault();
        }

        , __localize: function (string) {
            var messages = $.fn.markdown.messages,
                language = this.$options.language;
            if (
                typeof messages !== 'undefined' &&
                typeof messages[language] !== 'undefined' &&
                typeof messages[language][string] !== 'undefined'
            ) {
                return messages[language][string];
            }
            return string;
        }

        , __getIcon: function (src) {
            return typeof src == 'object' ? src[this.$options.iconlibrary] : src;
        }

        , setFullscreen: function (mode) {
            var $editor = this.$editor,
                $textarea = this.$textarea,
                $innerPreview = this.$innerPreview,
            //小预览窗口
                preview = $('div[data-provider="markdown-preview"]'),
            //预览按钮
                previewButton = $('button[data-handler="bootstrap-markdown-cmdPreview"]');
            if (mode) {
                if (this.$isPreview) {
                    this.hidePreview();
                }
                $editor.addClass('md-fullscreen-mode');
                $('body').addClass('md-nooverflow');
                this.$options.onFullscreen(this);

                $innerPreview.html(marked($textarea.val()));
                $textarea.keyup(function (evt) {
                    $innerPreview.html(marked($textarea.val()));
                });

                $textarea.scroll(function () {
                    var __this = $(this).get(0),
                        scrollHeight = __this.scrollHeight,
                        scrollTop = __this.scrollTop;
                    var __inner = $innerPreview.get(0),
                        innerHeight = __inner.scrollHeight;
                    var top = scrollTop * innerHeight / scrollHeight;
                    $innerPreview.scrollTop(top);
                });
                //up by wpl
                if (preview) {
                    preview.remove();
                }
                if (previewButton) {
                    previewButton.hide();
                }
            } else {
                $editor.removeClass('md-fullscreen-mode');
                $('body').removeClass('md-nooverflow');
                //up by wpl
                if (previewButton) {
                    previewButton.show();
                }
                if (this.$isPreview) {
                    this.showPreview();
                }
            }

            this.$isFullscreen = mode;
            $textarea.focus();
        }, showEditor: function () {

            var instance = this,
                textarea,
                ns = this.$ns,
                container = this.$element,
                originalHeigth = container.css('height'),
                originalWidth = container.css('width'),
                editable = this.$editable,
                handler = this.$handler,
                callback = this.$callback,
                editorId = this.$editorId,
                options = this.$options,
                _fullPreview = this.$fullPreview,
                innerPreview = this.$fullPreview,
                cutPaste = this.$cutPaste,
                editor = $('<div/>', {
                    'class': 'md-editor',
                    click: function () {
                        instance.focus();
                    }
                });

            // Prepare the editor
            if (this.$editor === null) {
                // Create the panel
                var editorHeader = $('<div/>', {
                    'class': 'md-header btn-toolbar'
                });

                // Merge the main & additional button groups together
                var allBtnGroups = [];
                if (options.buttons.length > 0) allBtnGroups = allBtnGroups.concat(options.buttons[0]);
                if (options.additionalButtons.length > 0) allBtnGroups = allBtnGroups.concat(options.additionalButtons[0]);

                // Reduce and/or reorder the button groups
                if (options.reorderButtonGroups.length > 0) {
                    allBtnGroups = allBtnGroups
                        .filter(function (btnGroup) {
                            return options.reorderButtonGroups.indexOf(btnGroup.name) > -1;
                        })
                        .sort(function (a, b) {
                            if (options.reorderButtonGroups.indexOf(a.name) < options.reorderButtonGroups.indexOf(b.name)) return -1;
                            if (options.reorderButtonGroups.indexOf(a.name) > options.reorderButtonGroups.indexOf(b.name)) return 1;
                            return 0;
                        });
                }

                // Build the buttons
                if (allBtnGroups.length > 0) {
                    editorHeader = this.__buildButtons([allBtnGroups], editorHeader);
                }

                if (options.fullscreen.enable) {
                    editorHeader.append('<div class="md-controls"><a class="md-control md-control-fullscreen" href="#"><span class="' + this.__getIcon(options.fullscreen.icons.fullscreenOn) + '"></span></a></div>').on('click', '.md-control-fullscreen', function (e) {
                        e.preventDefault();
                        instance.setFullscreen(true);
                    });
                }

                editor.append(editorHeader);

                // Wrap the textarea
                if (container.is('textarea')) {
                    container.before(editor);
                    textarea = container;
                    textarea.addClass('md-input');
                    editor.append(textarea);
                } else {
                    var rawContent = (typeof toMarkdown == 'function') ? toMarkdown(container.html()) : container.html(),
                        currentContent = $.trim(rawContent);
                    // This is some arbitrary content that could be edited
                    textarea = $('<textarea/>', {
                        'class': 'md-input',
                        'val': currentContent,
                        'text': _localCache
                    });

                    editor.append(textarea);

                    // Save the editable
                    editable.el = container;
                    editable.type = container.prop('tagName').toLowerCase();
                    editable.content = container.html();

                    $(container[0].attributes).each(function () {
                        editable.attrKeys.push(this.nodeName);
                        editable.attrValues.push(this.nodeValue);
                    });

                    // Set editor to blocked the original container
                    container.replaceWith(editor);
                }

                //add by wpl
                if (options.fullscreen.enable && _fullPreview === null) {
                    _fullPreview = $('<div/>', {
                        'class': 'md-full-preview'
                    });
                    var previewBody = $('<div/>', {
                        'class': 'md-full-preview-body'
                    });

                    innerPreview = $('<div/>', {
                        'class': 'md-full-preview-inner'
                    });
                    previewBody.append(innerPreview);
                    _fullPreview.append(previewBody);
                    var leftTool = $('<div/>', {
                        'class': 'md-full-preview-tool'
                    });
                    _fullPreview.append(leftTool);
                    editor.append(_fullPreview);

                    this.$innerPreview = innerPreview;
                    this.$fullPreview = _fullPreview;
                }

                var editorFooter = $('<div/>', {
                        'class': 'md-footer'
                    }),
                    createFooter = false,
                    footer = '';
                // Create the footer if savable
                if (options.savable) {
                    createFooter = true;
                    var saveHandler = 'cmdSave';

                    // Register handler and callback
                    handler.push(saveHandler);
                    callback.push(options.onSave);

                    editorFooter.append('<button class="btn btn-success" data-provider="'
                    + ns
                    + '" data-handler="'
                    + saveHandler
                    + '"><i class="icon icon-white icon-ok"></i> '
                    + this.__localize('Save')
                    + '</button>');
                }

                if (null === cutPaste) {
                    cutPaste = $('<div/>', {
                        class: 'md-cut-paste',
                        contenteditable: true
                    });

                    editor.append(cutPaste);
                }

                footer = typeof options.footer === 'function' ? options.footer(this) : options.footer;

                if ($.trim(footer) !== '') {
                    createFooter = true;
                    editorFooter.append(footer);
                }

                if (createFooter) editor.append(editorFooter);

                // Set width
                if (options.width && options.width !== 'inherit') {
                    if (jQuery.isNumeric(options.width)) {
                        editor.css('display', 'table');
                        textarea.css('width', options.width + 'px');
                    } else {
                        editor.addClass(options.width);
                    }
                }

                // Set height
                if (options.height && options.height !== 'inherit') {
                    if (jQuery.isNumeric(options.height)) {
                        var height = options.height;
                        if (editorHeader) height = Math.max(0, height - editorHeader.outerHeight());
                        if (editorFooter) height = Math.max(0, height - editorFooter.outerHeight());
                        textarea.css('height', height + 'px');
                    } else {
                        editor.addClass(options.height);
                    }
                }

                // Reference
                this.$editor = editor;
                this.$textarea = textarea;
                this.$editable = editable;
                this.$cutPaste = cutPaste;
                this.$oldContent = this.getContent();

                this.__setListener();

                // Set editor attributes, data short-hand API and listener
                this.$editor.attr('id', new Date().getTime().toString());

                var _localCache = '',
                    _localStorage = this.$localStorage;
                if (window.localStorage && _localStorage && '' !== _localStorage) {
                    _localCache = localStorage.getItem(_localStorage);
                    this.$textarea.val(_localCache);
                }

                this.$editor.on('click', '[data-provider="bootstrap-markdown"]', $.proxy(this.__handle, this));

                if (this.$element.is(':disabled') || this.$element.is('[readonly]')) {
                    this.$editor.addClass('md-editor-disabled');
                    this.disableButtons('all');
                }

                if (this.eventSupported('keydown') && typeof jQuery.hotkeys === 'object') {
                    editorHeader.find('[data-provider="bootstrap-markdown"]').each(function () {
                        var $button = $(this),
                            hotkey = $button.attr('data-hotkey');
                        if (hotkey.toLowerCase() !== '') {
                            textarea.bind('keydown', hotkey, function () {
                                $button.trigger('click');
                                return false;
                            });
                        }
                    });
                }

                if (options.initialstate === 'preview') {
                    this.showPreview();
                } else if (options.initialstate === 'fullscreen' && options.fullscreen.enable) {
                    this.setFullscreen(true);
                }

            } else {
                this.$editor.show();
            }

            if (options.autofocus) {
                this.$textarea.focus();
                this.$editor.addClass('active');
            }

            if (options.fullscreen.enable && options.fullscreen !== false && !this.$fullscreenControls) {
                this.$editor.append('\
          <div class="md-fullscreen-controls">\
            <a href="#" class="exit-fullscreen" title="Exit fullscreen"><span class="' + this.__getIcon(options.fullscreen.icons.fullscreenOff) + '"></span></a>\
          </div>');
                this.$fullscreenControls = true;
                this.$editor.on('click', '.exit-fullscreen', function (e) {
                    e.preventDefault();
                    instance.setFullscreen(false);
                });
            }

            // hide hidden buttons from options
            this.hideButtons(options.hiddenButtons);

            // disable disabled buttons from options
            this.disableButtons(options.disabledButtons);

            // Trigger the onShow hook
            options.onShow(this);

            if (!this.$registPaste) {
                this.registPaste();
                this.$registPaste = true;
            }
            this.localCache();

            return this;
        }

        , parseContent: function (val) {
            var content;

            // parse with supported markdown parser
            var val = val || this.$textarea.val();
            if (typeof markdown == 'object') {
                content = markdown.toHTML(val);
            } else if (typeof marked == 'function') {
                content = marked(val);
            } else {
                content = val;
            }

            return content;
        }
        , showUpload: function (e) {
            var _this = this,
                uploadPanel = this.$uploadPanel,
                editor = this.$editor,
            //upload panel
                mdUpload = null,
                mdDialog = null,
                mdContent = null,
                mdContentHeader = null,
                mdContentBody = null,
                mdContentFooter = null,
                inputGroup = null,
                localUpload = null,
                localUploadField = null,
                urlInput = null,
                stateBar = null,
                cancleButton = null,
                okButton = null,
                progressBar = null,
                progress = null,
                percent = null;
            if (this.$editor !== null && uploadPanel == null) {
                mdUpload = $('<div />', {
                    'class': 'md-upload',
                    'data-provide': 'markdown-upload'
                }).on('click', function (evt) {
                    if ($(evt.target).is('div.md-upload'))
                        _this.hideUpload();
                });

                mdDialog = $('<div/>', {
                    'class': 'md-dialog',
                    'data-provide': 'markdown-upload-dialog'
                });

                mdContent = $('<div/>', {
                    'class': 'md-content',
                    'data-provide': 'markdown-upload-content'
                });


                mdContentHeader = $('<div/>', {
                    'class': 'md-content-header',
                    'data-provide': 'markdown-upload-content-header'
                }).append($('<i/>', {
                    type: 'button',
                    class: 'md-content-header-button glyphicon glyphicon-remove'
                })).on('click', function (evt) {
                    if ($(evt.target).is('i.md-content-header-button'))
                        _this.hideUpload();
                }).append($('<h4/>', {
                    class: 'md-content-header-title',
                    text: e.__localize('Image')
                }));

                mdContentBody = $('<div/>', {
                    'class': 'md-content-body',
                    'data-provide': 'markdown-upload-content-body'
                }).append($('<div/>', {
                    class: 'md-content-body-danger',
                    text: e.__localize('ImageTip')
                })).append($('<p/>', {
                    text: e.__localize('ImageInputTip')
                }));

                inputGroup = $('<div/>', {
                    class: 'md-content-body-input-group'
                });

                localUpload = $('<span />', {
                    class: 'md-input-group-addon glyphicon glyphicon-picture'
                });
                localUploadField = $('<input>', {
                    type: 'file',
                    class: 'md-input-insert-image',
                    formenctype: 'multipart/form-data'
                });
                localUploadField.change(function () {
                    _this.fileUpload();
                });

                localUpload.on('click', function (evt) {
                    if (typeof FormData === "undefined") {
                        stateBar.html(e.__localize('BrowerSupportTip'));
                        return;
                    }
                    localUploadField.trigger('click');
                    return false;
                });

                urlInput = $('<input>', {
                    type: 'text',
                    class: 'md-input-image-url',
                    placeholder: 'http://example.com/image.jpg'
                });

                progressBar = $('<div/>', {class: 'md-progress-bar'});
                progress = $('<progress/>', {max: 100, value: 0});
                percent = $('<span/>', {
                    text: _this.__localize('Progress') + '0%'
                });

                progressBar.append(percent).append(progress);

                inputGroup.append(localUpload).append(localUploadField).append(urlInput);

                mdContentBody.append(inputGroup).append(progressBar);

                mdContentFooter = $('<div/>', {
                    'class': 'md-content-footer',
                    'data-provide': 'markdown-upload-content-footer'
                });

                stateBar = $('<span/>', {class: 'md-state-bar'});

                cancleButton = $('<button/>', {
                    class: 'btn btn-default',
                    text: e.__localize('Cancle')
                });

                cancleButton.bind('click', function () {
                    _this.hideUpload();
                });

                okButton = $('<button/>', {
                    class: 'btn btn-primary',
                    text: e.__localize('Insert')
                });

                okButton.bind('click', function () {
                    var link = urlInput.val();
                    if (null === link || '' === link) {
                        _this.setState(_this.__localize('ImageInputTip'));
                        return false;
                    }
                    _this.setImageLink(link);
                    _this.setPercent(0);
                    if (_this.$isFullscreen) {
                        _this.$innerPreview.html(marked(_this.$textarea.val()));
                    }
                    return false;
                });

                mdContentFooter.append(stateBar).append(cancleButton).append(okButton);

                mdContent.append(mdContentHeader).append(mdContentBody).append(mdContentFooter);

                mdDialog.append(mdContent);

                editor.append(mdUpload.append(mdDialog));

                this.$uploadPanel = mdUpload;
                this.$inputFile = localUploadField;
                this.$progress = progress;
                this.$percent = percent;
                this.$stateBar = stateBar;
                return;
            }

            uploadPanel.show();
        },
        setPercent: function (progress) {
            if (this.$percent) {
                this.$percent.html(this.__localize('Progress') + progress + '%');
            }
        },
        setState: function (text,color) {
            var _this = this;
            if (_this.$stateBar) {
                if(color){
                    _this.$stateBar.addClass('md-green');
                }
                _this.$stateBar.html(text);
                setTimeout(function () {
                    _this.$stateBar.html('');
                    _this.$stateBar.removeClass('md-green');
                }, 3000);
            }
        },
        fileUpload: function () {
            //ajax上传文件
            var _this = this,
                imgUrl = this.$options.imgurl,
                xhr = null,
                progress = this.$progress,
                file = null,
                maxFileSize = this.$fileSize,
                uploadImgURL = "",
                uploadPanel = this.$uploadPanel,
                inputFile = this.$inputFile,
                _fileSize = 0,
                _fileName = '',
                _suffixReg = /^.*\.(?:jpg|png|gif)$/,
                formData = new FormData();
            if(progress && progress.length>0){
                progress = progress.get(0);
            }
            if (null === imgUrl || '' === imgUrl) {
                _this.setState(_this.__localize('UploadPathTip'));
                return;
            }
            if (inputFile.length > 0 && inputFile[0].files && inputFile[0].files.length > 0) {
                formData.append('img', inputFile[0].files[0]);
                file = inputFile[0].files[0];
                _fileSize = file.size;
                _fileName = file.name.toLowerCase();

                if (!_fileName.match(_suffixReg)) {
                    _this.setState(_this.__localize('SupportTypeTip'));
                    return;
                }

                if (_fileSize > maxFileSize) {
                    _this.setState(_this.__localize('FileSizeTip'));
                    return;
                }

                xhr = new XMLHttpRequest();
                xhr.upload.onprogress = function (evt) {
                    _this.setPercent(Math.round(evt.loaded * 100 / evt.total));
                    progress.max = evt.total;
                    progress.value = evt.loaded;
                };

                xhr.upload.onload = function () {
                    setTimeout(function () {
                        _this.setPercent(0);
                        progress.max = 100;
                        progress.value = 0;
                        _this.setState(_this.__localize('ProgressLoaded'),true);
                    }, 1000);
                };

                xhr.upload.onerror = function () {
                    _this.setPercent(0);
                    progress.max = 100;
                    progress.value = 0;

                    uploadPanel.find('input.md-input-insert-image').val('');
                    uploadPanel.find('input.md-input-image-url').val('');

                    _this.setState(_this.__localize('UploadEooroTip'));
                };

                xhr.onreadystatechange = function () {
                    if (xhr.readyState === 4 && xhr.status === 200) {
                        uploadImgURL = xhr.responseText;
                        if ('' !== uploadImgURL) {
                            //_this.setImageLink(uploadImgURL);
                            uploadPanel.find('input.md-input-image-url').val(uploadImgURL);
                        }
                    }
                };

                xhr.open('POST', imgUrl, true);
                xhr.setRequestHeader("Cache-Control", "no-cache");
                xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
                xhr.send(formData);
            }
        }
        , xhrImageUpload: function (base64) {
            var _this = this,
                base64Url = this.$options.base64url;
            if (null === base64Url || '' === base64Url)
                return;
            if (base64.indexOf("data:image/png;base64") !== -1) {
                var imageFormData = new FormData();
                imageFormData.append("base64Date", base64);
                var xhr = new XMLHttpRequest();
                xhr.onreadystatechange = function () {
                    if (xhr.readyState === 4 && xhr.status === 200) {
                        var link = xhr.responseText;
                        if ('' !== link) {
                            _this.setImageLink(link);
                        }
                    }
                };
                xhr.upload.onerror = function () {
                    alert(_this.__localize('ImagePasteField'));
                };
                xhr.open("POST", base64Url, true);
                xhr.setRequestHeader("Cache-Control", "no-cache");
                xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
                xhr.send(imageFormData);
            }
        }
        , setImageLink: function (link) {
            // Give ![] surround the selection and prepend the image link
            var _this = this, chunk, cursor, instance = this, selected = instance.getSelection(), content = instance.getContent(), _link = link;

            if (selected.length === 0) {
                // Give extra word
                chunk = instance.__localize('enter image description here');
            } else {
                chunk = selected.text;
            }

            //link = prompt(e.__localize('Insert Image Hyperlink'), 'http://');

            if (_link !== null && _link !== '' && _link !== 'http://' && (_link.substr(0, 4) === 'http' || _link.substr(0, 21) === 'data:image/png;base64')) {
                var sanitizedLink = $('<div>' + _link + '</div>').text();

                // transform selection and set the cursor into chunked text
                instance.replaceSelection('![' + chunk + '](' + sanitizedLink + ' "' + instance.__localize('enter image title here') + '")');
                cursor = selected.start + 2;

                // Set the next tab
                instance.setNextTab(instance.__localize('enter image title here'));

                // Set the cursor
                instance.setSelection(cursor, cursor + chunk.length);
                if (_this.$isFullscreen) {
                    _this.$innerPreview.html(marked(_this.$textarea.val()));
                }
                this.hideUpload();
            } else {

            }
        }
        , hideUpload: function () {
            var uploadPanel = this.$uploadPanel,
                textarea = this.$textarea;
            if (null !== uploadPanel) {
                textarea.focus();
                uploadPanel.find('input.md-input-insert-image').val('');
                uploadPanel.find('input.md-input-image-url').val('');
                uploadPanel.hide();
                this.$uploadMode = false;
            }
        }
        , localCache: function () {
            var _localStorage = this.$localStorage,
                textarea = this.$textarea;
            if (window.localStorage && _localStorage && '' !== _localStorage) {
                setInterval(function () {
                    localStorage.setItem(_localStorage, textarea.val());
                }, 1000);
            }
        }
        , registPaste: function () {
            var _this = this,
                cutPaste = this.$cutPaste,
                editor = this.$editor,
                timeStamp = null,
                browser = navigator.userAgent.toLowerCase();
            if (null === cutPaste)
                return;

            var firefox = false,
                chrome = false,
                trident = false;

            if (/firefox/i.test(browser)) {
                editor.keypress(function (event) {
                    _this.pasteFunc(event, firefox)
                });
            } else if (/chrome/i.test(browser) && /webkit/i.test(browser) && /mozilla/i.test(browser)) {
                chrome = true;
                editor.on('paste', function (event) {
                    _this.pasteFunc(event, chrome);
                });
            } else if (/trident/i.test(browser)) {
                editor.keydown(function (event) {
                    _this.pasteFunc(event, trident)
                });
            }

        }
        , pasteFunc: function (event, chrome) {
            var _this = this,
                cutPaste = this.$cutPaste,
                textarea = this.$textarea,
                uploadMode = this.$uploadMode;

            if (!chrome) {
                //防止一个粘贴BUG
                if (uploadMode)
                    return;
            }
            if (!chrome && (event.ctrlKey || event.metaKey) && (event.keyCode === 86 || event.key === 'v')) {
                cutPaste.focus();
                setTimeout(function () {
                    var imgs = cutPaste.find('img'), img = null, base64 = null;
                    textarea.focus();
                    if (imgs && imgs.length > 0) {
                        img = imgs[0];
                        base64 = img.src;
                        if (base64 && '' !== base64) {
                            _this.xhrImageUpload(base64);
                        }
                        imgs.remove();
                    }
                    var text = '';
                    if (window.clipboardData) {
                        text = window.clipboardData.getData('Text');
                    } else {
                        text = cutPaste.html();
                        text = text.replace(/<br\s*\/?>|<br\s*?>/ig, "\n")
                            .replace(/<\/?[^>]*>/g, function ($0, $1) {
                                if('</p>'===$0 ||'</div>'===$0){
                                    return "\n";
                                }
                                return "";
                            })
                            .replace(/[ | ]*\n/g, "\n")
                            .replace(/&nbsp;/g, " ")
                            .replace(/&lt;/g, "<")
                            .replace(/&gt;/g, ">")
                            .replace(/&amp;/g, "&");
                    }
                    if (text) {
                        var selection = _this.getSelection().start;
                        _this.replaceSelection(text);
                        _this.setSelection(selection + text.length, selection + text.length);
                    }
                    cutPaste.empty();
                }, 10);
            } else if (chrome) {
                var clipboardData, items, item, _i = 0, _length, _ref;
                if (((_ref = event.originalEvent) !== null ? _ref.clipboardData : void 0) !== null) {
                    clipboardData = event.originalEvent.clipboardData;
                    if (items = clipboardData.items) {
                        _length = items.length;
                        for (; _i < _length; ++_i) {
                            item = items[_i];
                            if (item && item.type.match(/^image\//)) {
                                var blob = item.getAsFile(), reader = new FileReader(), base64 = null;
                                reader.onload = function (evt) {
                                    base64 = evt.target.result;
                                    if (base64 && '' !== base64) {
                                        _this.xhrImageUpload(base64);
                                    }
                                };
                                reader.readAsDataURL(blob);
                            }
                        }
                    }
                }
            }
        }
        , showPreview: function () {
            var options = this.$options,
                container = this.$textarea,
                afterContainer = container.next(),
                replacementContainer = $('<div/>', {'class': 'md-preview', 'data-provider': 'markdown-preview'}),
                content,
                callbackContent;

            // Give flag that tell the editor enter preview mode
            this.$isPreview = true;
            // Disable all buttons
            this.disableButtons('all').enableButtons('cmdPreview');

            // Try to get the content from callback
            callbackContent = options.onPreview(this);
            // Set the content based from the callback content if string otherwise parse value from textarea
            content = typeof callbackContent == 'string' ? callbackContent : this.parseContent();

            // Build preview element
            replacementContainer.html(content);

            if (afterContainer && afterContainer.attr('class') == 'md-footer') {
                // If there is footer element, insert the preview container before it
                replacementContainer.insertBefore(afterContainer);
            } else {
                // Otherwise, just append it after textarea
                container.parent().append(replacementContainer);
            }

            // Set the preview element dimensions
            replacementContainer.css({
                //width: container.outerWidth() + 'px',
                width: '100%',
                height: container.outerHeight() + 'px'
            });

            if (this.$options.resize) {
                replacementContainer.css('resize', this.$options.resize);
            }

            // Hide the last-active textarea
            container.hide();

            // Attach the editor instances
            replacementContainer.data('markdown', this);

            if (this.$element.is(':disabled') || this.$element.is('[readonly]')) {
                this.$editor.addClass('md-editor-disabled');
                this.disableButtons('all');
            }
            return this;
        }

        , hidePreview: function () {
            // Give flag that tell the editor quit preview mode
            this.$isPreview = false;

            // Obtain the preview container
            var container = this.$editor.find('div[data-provider="markdown-preview"]');

            // Remove the preview container
            container.remove();

            // Enable all buttons
            this.enableButtons('all');
            // Disable configured disabled buttons
            this.disableButtons(this.$options.disabledButtons);

            // Back to the editor
            this.$textarea.show();
            this.__setListener();

            return this;
        }

        , isDirty: function () {
            return this.$oldContent != this.getContent();
        }

        , getContent: function () {
            return this.$textarea.val();
        }

        , setContent: function (content) {
            this.$textarea.val(content);

            return this;
        }

        , findSelection: function (chunk) {
            var content = this.getContent(), startChunkPosition;

            if (startChunkPosition = content.indexOf(chunk), startChunkPosition >= 0 && chunk.length > 0) {
                var oldSelection = this.getSelection(), selection;

                this.setSelection(startChunkPosition, startChunkPosition + chunk.length);
                selection = this.getSelection();

                this.setSelection(oldSelection.start, oldSelection.end);

                return selection;
            } else {
                return null;
            }
        }
        , getSelection: function () {

            var e = this.$textarea[0];

            return (

            ('selectionStart' in e && function () {
                var l = e.selectionEnd - e.selectionStart;
                return {
                    start: e.selectionStart,
                    end: e.selectionEnd,
                    length: l,
                    text: e.value.substr(e.selectionStart, l)
                };
            }) ||

                /* browser not supported */
            function () {
                return null;
            }

            )();

        }

        , setSelection: function (start, end) {

            var e = this.$textarea[0];

            return (

            ('selectionStart' in e && function () {
                e.selectionStart = start;
                e.selectionEnd = end;
                return;
            }) ||

                /* browser not supported */
            function () {
                return null;
            }

            )();

        }

        , replaceSelection: function (text) {

            var e = this.$textarea[0];

            return (

            ('selectionStart' in e && function () {
                e.value = e.value.substr(0, e.selectionStart) + text + e.value.substr(e.selectionEnd, e.value.length);
                // Set cursor to the last replacement end
                e.selectionStart = e.value.length;
                return this;
            }) ||

                /* browser not supported */
            function () {
                e.value += text;
                return jQuery(e);
            }

            )();
        }

        , getNextTab: function () {
            // Shift the nextTab
            if (this.$nextTab.length === 0) {
                return null;
            } else {
                var nextTab, tab = this.$nextTab.shift();

                if (typeof tab == 'function') {
                    nextTab = tab();
                } else if (typeof tab == 'object' && tab.length > 0) {
                    nextTab = tab;
                }

                return nextTab;
            }
        }

        , setNextTab: function (start, end) {
            // Push new selection into nextTab collections
            if (typeof start == 'string') {
                var that = this;
                this.$nextTab.push(function () {
                    return that.findSelection(start);
                });
            } else if (typeof start == 'number' && typeof end == 'number') {
                var oldSelection = this.getSelection();

                this.setSelection(start, end);
                this.$nextTab.push(this.getSelection());

                this.setSelection(oldSelection.start, oldSelection.end);
            }

            return;
        }

        , __parseButtonNameParam: function (nameParam) {
            var buttons = [];

            if (typeof nameParam == 'string') {
                buttons = nameParam.split(',')
            } else {
                buttons = nameParam;
            }

            return buttons;
        }

        , enableButtons: function (name) {
            var buttons = this.__parseButtonNameParam(name),
                that = this;

            $.each(buttons, function (i, v) {
                that.__alterButtons(buttons[i], function (el) {
                    el.removeAttr('disabled');
                });
            });

            return this;
        }

        , disableButtons: function (name) {
            var buttons = this.__parseButtonNameParam(name),
                that = this;

            $.each(buttons, function (i, v) {
                that.__alterButtons(buttons[i], function (el) {
                    el.attr('disabled', 'disabled');
                });
            });

            return this;
        }

        , hideButtons: function (name) {
            var buttons = this.__parseButtonNameParam(name),
                that = this;

            $.each(buttons, function (i, v) {
                that.__alterButtons(buttons[i], function (el) {
                    el.addClass('hidden');
                });
            });

            return this;
        }

        , showButtons: function (name) {
            var buttons = this.__parseButtonNameParam(name),
                that = this;

            $.each(buttons, function (i, v) {
                that.__alterButtons(buttons[i], function (el) {
                    el.removeClass('hidden');
                });
            });

            return this;
        }

        , eventSupported: function (eventName) {
            var isSupported = eventName in this.$element;
            if (!isSupported) {
                this.$element.setAttribute(eventName, 'return;');
                isSupported = typeof this.$element[eventName] === 'function';
            }
            return isSupported;
        }

        , keyup: function (e) {
            var blocked = false;
            switch (e.keyCode) {
                case 40: // down arrow
                case 38: // up arrow
                case 16: // shift
                case 17: // ctrl
                case 18: // alt
                    break;

                case 9: // tab
                    /*var nextTab;
                     if (nextTab = this.getNextTab(), nextTab !== null) {
                     // Get the nextTab if exists
                     var that = this;
                     setTimeout(function () {
                     that.setSelection(nextTab.start, nextTab.end);
                     }, 500);

                     blocked = true;
                     } else {
                     // The next tab memory contains nothing...
                     // check the cursor position to determine tab action
                     var cursor = this.getSelection();

                     if (cursor.start == cursor.end && cursor.end == this.getContent().length) {
                     // The cursor already reach the end of the content
                     blocked = false;
                     } else {
                     // Put the cursor to the end
                     this.setSelection(this.getContent().length, this.getContent().length);

                     blocked = true;
                     }
                     }*/

                    break;

                case 13: // enter
                    blocked = false;
                    break;
                case 27: // escape
                    if (this.$isFullscreen) this.setFullscreen(false);
                    blocked = false;
                    break;

                default:
                    blocked = false;
            }

            if (blocked) {
                e.stopPropagation();
                e.preventDefault();
            }

            this.$options.onChange(this);
        }

        , change: function (e) {
            this.$options.onChange(this);
            return this;
        }

        , focus: function (e) {
            var options = this.$options,
                isHideable = options.hideable,
                editor = this.$editor;

            editor.addClass('active');

            // Blur other markdown(s)
            $(document).find('.md-editor').each(function () {
                if ($(this).attr('id') !== editor.attr('id')) {
                    var attachedMarkdown;

                    if (attachedMarkdown = $(this).find('textarea').data('markdown'),
                        attachedMarkdown === null) {
                        attachedMarkdown = $(this).find('div[data-provider="markdown-preview"]').data('markdown');
                    }

                    if (attachedMarkdown) {
                        attachedMarkdown.blur();
                    }
                }
            });

            // Trigger the onFocus hook
            options.onFocus(this);

            return this;
        }

        , blur: function (e) {
            var options = this.$options,
                isHideable = options.hideable,
                editor = this.$editor,
                editable = this.$editable;

            if (editor.hasClass('active') || this.$element.parent().length === 0) {
                editor.removeClass('active');

                if (isHideable) {
                    // Check for editable elements
                    if (editable.el !== null) {
                        // Build the original element
                        var oldElement = $('<' + editable.type + '/>'),
                            content = this.getContent(),
                            currentContent = (typeof markdown == 'object') ? markdown.toHTML(content) : content;

                        $(editable.attrKeys).each(function (k, v) {
                            oldElement.attr(editable.attrKeys[k], editable.attrValues[k]);
                        });

                        // Get the editor content
                        oldElement.html(currentContent);

                        editor.replaceWith(oldElement);
                    } else {
                        editor.hide();
                    }
                }

                // Trigger the onBlur hook
                options.onBlur(this);
            }

            return this;
        }
        , showEmojiPanel: function (e) {
            var _this = this,
                emojiPanel = this.$emojiPanel,
                emojiElements = this.$emojiElements,
                editor = this.$editor,
            //emojiPanel panel
                mdEmoji = null,
                mdDialog = null,
                mdContent = null,
                mdContentHeader = null,
                mdContentBody = null,
                mdContentFooter = null,
                textarea = this.$textarea,
                fullScreen = this.$isFullscreen,
                innerPreview = this.$innerPreview;

            if (emojiElements === null) {
                emojiElements = _this.initEmoji();
            }

            if (this.$editor !== null && emojiPanel == null) {
                mdEmoji = $('<div />', {
                    'class': 'md-emoji',
                    'data-provide': 'markdown-emoji'
                }).on('click', function (evt) {
                    if ($(evt.target).is('div.md-emoji'))
                        _this.hideEmoji();
                });

                mdDialog = $('<div/>', {
                    'class': 'md-dialog',
                    'data-provide': 'markdown-emoji-dialog'
                });

                mdContent = $('<div/>', {
                    'class': 'md-content',
                    'data-provide': 'markdown-upload-content'
                });

                mdContentHeader = $('<div/>', {
                    'class': 'md-content-header',
                    'data-provide': 'markdown-upload-content-header'
                }).append($('<i/>', {
                    type: 'button',
                    class: 'md-content-header-button glyphicon glyphicon-remove'
                })).on('click', function (evt) {
                    if ($(evt.target).is('i.md-content-header-button'))
                        _this.hideEmoji();
                }).append($('<Strong/>', {
                    class: 'md-content-header-title',
                    text: e.__localize('Emoji')
                }));

                mdContentBody = $('<div/>', {
                    'class': 'md-content-body md-emoji',
                    'data-provide': 'markdown-upload-content-body'
                }).append(emojiElements);

                mdContent.append(mdContentHeader).append(mdContentBody).append(mdContentFooter);
                mdDialog.append(mdContent);
                editor.append(mdEmoji.append(mdDialog));

                emojiElements.on('click', function (evt) {
                    var __this = $(this),
                        groupName = _this.$emoji['groupName'],
                        groupNav = _this.$emoji['groupNav'],
                        groupPanel = _this.$emoji['groupPanel'],
                        _target = evt.target;
                    if (_target) {
                        var tagName = _target.tagName;
                        if (tagName === 'LI') {
                            var nav = _target.getAttribute('data-emoji-target');
                            for (var i = 0; i < groupName.length; ++i) {
                                var __groupName = groupName[i];
                                if (__groupName === nav) {
                                    groupNav[__groupName].addClass('active');
                                    groupPanel[__groupName].show().scrollTop(0);
                                    continue;
                                }
                                groupNav[__groupName].removeClass('active');
                                groupPanel[__groupName].hide();
                            }
                            return;
                        }

                        var emojiKeyword = _target.getAttribute('data-emoji');
                        if (tagName === 'DIV' && emojiKeyword) {
                            // Give/remove ** surround the selection
                            var selected = e.getSelection(),
                                keywordLength = emojiKeyword.length + 2;
                            e.replaceSelection(":" + emojiKeyword + ":");
                            e.setSelection(selected.start + keywordLength, selected.end + keywordLength);
                            e.hideEmoji();
                            if (fullScreen) {
                                innerPreview.html(marked(textarea.val()));
                            }
                        }
                    }
                });

                this.$emojiPanel = mdEmoji;
                this.$emojiElements = emojiElements;
                return;
            }
            emojiPanel.show();
        }
        , hideEmoji: function () {
            var textarea = this.$textarea,
                emojiPanel = this.$emojiPanel;
            if (null != emojiPanel) {
                emojiPanel.hide();
            }
            textarea.focus();
        }
        , initEmoji: function () {

            var emoji = this.$emoji,
                emojiGroup = emoji['groupName'],
                emojiPanel = $('<div/>', {
                    class: 'md-emoji-panel'
                });
            var emojiNavPanel = $('<ul/>', {
                class: 'md-emoji-nav'
            });
            for (var egIndex = 0; egIndex < emojiGroup.length; ++egIndex) {
                var group = emoji['groups'][emojiGroup[egIndex]],
                    nav = this.renderEmojiNav(emojiGroup[egIndex], !egIndex);
                this.$emoji['groupNav'][emojiGroup[egIndex]] = nav;
                emojiNavPanel.append(nav);
                if (group instanceof Array) {
                    var _panel = this.renderEmoji(group, emojiGroup[egIndex], false);
                    this.$emoji['groupPanel'][emojiGroup[egIndex]] = _panel;
                    emojiPanel.append(_panel.hide());
                    continue;
                }
                if (group instanceof Object) {
                    var githubPanel = $('<div/>', {
                            'data-group': emojiGroup[egIndex]
                        }),
                        githubGroup = ['People', 'Nature', 'Objects', 'Places', 'Symbols'];
                    for (var ghIndex = 0; ghIndex < githubGroup.length; ++ghIndex) {
                        var name = githubGroup[ghIndex],
                            github = group[name];
                        if (github instanceof Array) {
                            githubPanel.append(this.renderEmoji(github, name, true));
                        }
                    }
                    this.$emoji['groupPanel'][emojiGroup[egIndex]] = githubPanel;
                    emojiPanel.append(emojiNavPanel)
                        .append(githubPanel);
                }
            }

            return emojiPanel;
        }
        ,renderEmojiNav: function (name, active) {
            var _class = active ? 'active' : '';
            return $('<li/>', {
                class: _class,
                'data-emoji-target': name,
                text: name
            });
        }
        , renderEmoji: function (group, name, title) {
            var cols = 20,
                fontawesome = ' fa ',
                groupPanel = $('<div/>', {
                    'data-group': name
                }),
                groupLength = group.length,
                mod = groupLength % cols,
                rows = mod === 0 ? groupLength / cols : parseInt(groupLength / cols) + 1;
            if (title) {
                groupPanel.append($('<div/>', {
                    'data-group-title': 'emoji-group-title',
                    text: name
                }));
            }
            for (var row = 0; row < rows; row++) {
                var rowGroup = $('<div/>', {
                    class: 'emoji-row'
                });
                for (var col = 0; col < cols; col++) {
                    var index = (row * cols) + col,
                        emojiName = group[index],
                        _class = 'emoji-block';

                    var emojiHtml = $('<div/>', {
                        class: _class,
                        title: emojiName,
                        'data-emoji': emojiName
                    });

                    if (name === 'font-awesome') {
                        _class += fontawesome;
                        _class += emojiName;
                        emojiHtml.attr({
                            class: _class,
                            'data-class': fontawesome + emojiName
                        });
                    }
                    rowGroup.append(emojiHtml);
                }
                groupPanel.append(rowGroup);
            }

            return groupPanel;
        }

    };

    /* MARKDOWN PLUGIN DEFINITION
     * ========================== */

    var old = $.fn.markdown;

    $.fn.markdown = function (option) {
        return this.each(function () {
            var $this = $(this)
                , data = $this.data('markdown')
                , options = typeof option == 'object' && option;
            if (!data) $this.data('markdown', (data = new Markdown(this, options)))
        })
    };

    $.fn.markdown.messages = {};

    $.fn.markdown.defaults = {
        /* Editor Properties */
        autofocus: true,
        hideable: false,
        savable: false,
        width: 'inherit',
        height: 'inherit',
        resize: 'none',
        iconlibrary: 'fa',
        language: 'en',
        initialstate: 'editor',
        imgurl: '',
        base64url: '',
        localStorage: '',
        /* Buttons Properties */
        buttons: [
            [{
                name: 'groupFont',
                data: [{
                    name: 'cmdBold',
                    hotkey: 'Ctrl+B',
                    title: 'Bold',
                    icon: {glyph: 'glyphicon glyphicon-bold', fa: 'fa fa-bold', 'fa-3': 'icon-bold'},
                    callback: function (e) {
                        // Give/remove ** surround the selection
                        var chunk, cursor, selected = e.getSelection(), content = e.getContent();

                        if (selected.length === 0) {
                            // Give extra word
                            chunk = e.__localize('strong text');
                        } else {
                            chunk = selected.text;
                        }

                        // transform selection and set the cursor into chunked text
                        if (content.substr(selected.start - 2, 2) === '**'
                            && content.substr(selected.end, 2) === '**') {
                            e.setSelection(selected.start - 2, selected.end + 2);
                            e.replaceSelection(chunk);
                            cursor = selected.start - 2;
                        } else {
                            e.replaceSelection('**' + chunk + '**');
                            cursor = selected.start + 2;
                        }

                        // Set the cursor
                        e.setSelection(cursor, cursor + chunk.length);
                    }
                }, {
                    name: 'cmdItalic',
                    title: 'Italic',
                    hotkey: 'Ctrl+I',
                    icon: {glyph: 'glyphicon glyphicon-italic', fa: 'fa fa-italic', 'fa-3': 'icon-italic'},
                    callback: function (e) {
                        // Give/remove * surround the selection
                        var chunk, cursor, selected = e.getSelection(), content = e.getContent();

                        if (selected.length === 0) {
                            // Give extra word
                            chunk = e.__localize('emphasized text');
                        } else {
                            chunk = selected.text;
                        }

                        // transform selection and set the cursor into chunked text
                        if (content.substr(selected.start - 1, 1) === '_'
                            && content.substr(selected.end, 1) === '_') {
                            e.setSelection(selected.start - 1, selected.end + 1);
                            e.replaceSelection(chunk);
                            cursor = selected.start - 1;
                        } else {
                            e.replaceSelection('_' + chunk + '_');
                            cursor = selected.start + 1;
                        }

                        // Set the cursor
                        e.setSelection(cursor, cursor + chunk.length);
                    }
                }, {
                    name: 'cmdHeading',
                    title: 'Heading',
                    hotkey: 'Ctrl+H',
                    icon: {glyph: 'glyphicon glyphicon-header', fa: 'fa fa-header', 'fa-3': 'icon-font'},
                    callback: function (e) {
                        // Append/remove ### surround the selection
                        var chunk, cursor, selected = e.getSelection(), content = e.getContent(), pointer = 4, prevChar;

                        if (selected.length === 0) {
                            // Give extra word
                            chunk = e.__localize('heading text');
                        } else {
                            chunk = selected.text + '\n';
                        }

                        // transform selection and set the cursor into chunked text
                        if (content.substr(selected.start - pointer, pointer) === '### '
                            || content.substr(selected.start - (--pointer), pointer) === '###') {
                            e.setSelection(selected.start - pointer, selected.end);
                            e.replaceSelection(chunk);
                            cursor = selected.start - pointer;
                        } else if (selected.start > 0 && (prevChar = content.substr(selected.start - 1, 1), !!prevChar && prevChar != '\n')) {
                            e.replaceSelection('\n\n### ' + chunk);
                            cursor = selected.start + 6;
                        } else {
                            // Empty string before element
                            e.replaceSelection('### ' + chunk);
                            cursor = selected.start + 4;
                        }

                        // Set the cursor
                        e.setSelection(cursor, cursor + chunk.length);
                    }
                }]
            }, {
                name: 'groupLink',
                data: [{
                    name: 'cmdUrl',
                    title: 'URL/Link',
                    hotkey: 'Ctrl+L',
                    icon: {glyph: 'glyphicon glyphicon-link', fa: 'fa fa-link', 'fa-3': 'icon-link'},
                    callback: function (e) {
                        // Give [] surround the selection and prepend the link
                        var chunk, cursor, selected = e.getSelection(), content = e.getContent(), link;

                        if (selected.length === 0) {
                            // Give extra word
                            chunk = e.__localize('enter link description here');
                        } else {
                            chunk = selected.text;
                        }

                        /* link = prompt(e.__localize('Insert Hyperlink'), 'http://');*/
                        link = 'http://';
                        /*  if (link !== null && link !== '' && link !== 'http://' && link.substr(0, 4) === 'http') {*/
                        var sanitizedLink = $('<div>' + link + '</div>').text();

                        // transform selection and set the cursor into chunked text
                        e.replaceSelection('[' + chunk + '](' + sanitizedLink + ')');
                        cursor = selected.start + chunk.length + 10;

                        // Set the cursor
                        e.setSelection(cursor, cursor);
                        /* }*/
                    }
                }, {
                    name: 'cmdImage',
                    title: 'Image',
                    hotkey: 'Ctrl+G',
                    icon: {glyph: 'glyphicon glyphicon-picture', fa: 'fa fa-picture-o', 'fa-3': 'icon-picture'},
                    callback: function (e) {
                        e.$uploadMode = true;
                        e.showUpload(e);

                    }
                }, {
                    name: 'cmdEmoji',
                    title: 'Emoji',
                    hotkey: 'Ctrl+E',
                    icon: {glyph: 'glyphicon glyphicon-user', fa: 'fa fa-smile-o', 'fa-3': 'icon-picture'},
                    callback: function (e) {
                        //e.$uploadMode = true;
                        e.showEmojiPanel(e);

                    }
                }]
            }, {
                name: 'groupMisc',
                data: [{
                    name: 'cmdList',
                    hotkey: 'Ctrl+U',
                    title: 'Unordered List',
                    icon: {glyph: 'glyphicon glyphicon-list', fa: 'fa fa-list', 'fa-3': 'icon-list-ul'},
                    callback: function (e) {
                        // Prepend/Give - surround the selection
                        var chunk, cursor, selected = e.getSelection(), content = e.getContent();

                        // transform selection and set the cursor into chunked text
                        if (selected.length === 0) {
                            // Give extra word
                            chunk = e.__localize('list text here');

                            e.replaceSelection('- ' + chunk);
                            // Set the cursor
                            cursor = selected.start + 2;
                        } else {
                            if (selected.text.indexOf('\n') < 0) {
                                chunk = selected.text;

                                e.replaceSelection('- ' + chunk);

                                // Set the cursor
                                cursor = selected.start + 2;
                            } else {
                                var list = [];

                                list = selected.text.split('\n');
                                chunk = list[0];

                                $.each(list, function (k, v) {
                                    list[k] = '- ' + v;
                                });

                                e.replaceSelection('\n\n' + list.join('\n'));

                                // Set the cursor
                                cursor = selected.start + 4;
                            }
                        }

                        // Set the cursor
                        e.setSelection(cursor, cursor + chunk.length);
                    }
                },
                    {
                        name: 'cmdListO',
                        hotkey: 'Ctrl+O',
                        title: 'Ordered List',
                        icon: {glyph: 'glyphicon glyphicon-th-list', fa: 'fa fa-list-ol', 'fa-3': 'icon-list-ol'},
                        callback: function (e) {

                            // Prepend/Give - surround the selection
                            var chunk, cursor, selected = e.getSelection(), content = e.getContent();

                            // transform selection and set the cursor into chunked text
                            if (selected.length === 0) {
                                // Give extra word
                                chunk = e.__localize('list text here');
                                e.replaceSelection('1. ' + chunk);
                                // Set the cursor
                                cursor = selected.start + 3;
                            } else {
                                if (selected.text.indexOf('\n') < 0) {
                                    chunk = selected.text;

                                    e.replaceSelection('1. ' + chunk);

                                    // Set the cursor
                                    cursor = selected.start + 3;
                                } else {
                                    var list = [];

                                    list = selected.text.split('\n');
                                    chunk = list[0];

                                    $.each(list, function (k, v) {
                                        list[k] = '1. ' + v;
                                    });

                                    e.replaceSelection('\n\n' + list.join('\n'));

                                    // Set the cursor
                                    cursor = selected.start + 5;
                                }
                            }

                            // Set the cursor
                            e.setSelection(cursor, cursor + chunk.length);
                        }
                    },
                    {
                        name: 'cmdCode',
                        hotkey: 'Ctrl+K',
                        title: 'Code',
                        icon: {glyph: 'glyphicon glyphicon-asterisk', fa: 'fa fa-code', 'fa-3': 'icon-code'},
                        callback: function (e) {
                            // Give/remove ** surround the selection
                            var chunk, cursor, selected = e.getSelection(), content = e.getContent();

                            if (selected.length === 0) {
                                // Give extra word
                                chunk = e.__localize('code text here');
                            } else {
                                chunk = selected.text;
                            }

                            // transform selection and set the cursor into chunked text
                            if (content.substr(selected.start - 4, 4) === '```\n'
                                && content.substr(selected.end, 4) === '\n```') {
                                e.setSelection(selected.start - 4, selected.end + 4);
                                e.replaceSelection(chunk);
                                cursor = selected.start - 4;
                            } else if (content.substr(selected.start - 1, 1) === '`'
                                && content.substr(selected.end, 1) === '`') {
                                e.setSelection(selected.start - 1, selected.end + 1);
                                e.replaceSelection(chunk);
                                cursor = selected.start - 1;
                            } else if (content.indexOf('\n') > -1) {
                                e.replaceSelection('```\n' + chunk + '\n```');
                                cursor = selected.start + 4;
                            } else {
                                e.replaceSelection('`' + chunk + '`');
                                cursor = selected.start + 1;
                            }

                            // Set the cursor
                            e.setSelection(cursor, cursor + chunk.length);
                        }
                    },
                    {
                        name: 'cmdQuote',
                        hotkey: 'Ctrl+Q',
                        title: 'Quote',
                        icon: {glyph: 'glyphicon glyphicon-comment', fa: 'fa fa-quote-left', 'fa-3': 'icon-quote-left'},
                        callback: function (e) {
                            // Prepend/Give - surround the selection
                            var chunk, cursor, selected = e.getSelection(), content = e.getContent();

                            // transform selection and set the cursor into chunked text
                            if (selected.length === 0) {
                                // Give extra word
                                chunk = e.__localize('quote here');

                                e.replaceSelection('> ' + chunk);

                                // Set the cursor
                                cursor = selected.start + 2;
                            } else {
                                if (selected.text.indexOf('\n') < 0) {
                                    chunk = selected.text;

                                    e.replaceSelection('> ' + chunk);

                                    // Set the cursor
                                    cursor = selected.start + 2;
                                } else {
                                    var list = [];

                                    list = selected.text.split('\n');
                                    chunk = list[0];

                                    $.each(list, function (k, v) {
                                        list[k] = '> ' + v;
                                    });

                                    e.replaceSelection('\n\n' + list.join('\n'));

                                    // Set the cursor
                                    cursor = selected.start + 4;
                                }
                            }

                            // Set the cursor
                            e.setSelection(cursor, cursor + chunk.length);
                        }
                    }]
            }, {
                name: 'groupUtil',
                data: [{
                    name: 'cmdPreview',
                    toggle: true,
                    hotkey: 'Ctrl+P',
                    title: 'Preview',
                    //btnText: 'Preview',
                    //btnClass: 'btn btn-primary btn-sm',
                    icon: {glyph: 'glyphicon glyphicon-search', fa: 'fa fa-search', 'fa-3': 'icon-search'},
                    callback: function (e) {
                        // Check the preview mode and toggle based on this flag
                        var isPreview = e.$isPreview, content;

                        if (isPreview === false) {
                            // Give flag that tell the editor enter preview mode
                            e.showPreview();
                        } else {
                            e.hidePreview();
                        }
                    }
                }]
            }]
        ],
        additionalButtons: [], // Place to hook more buttons by code
        reorderButtonGroups: [],
        hiddenButtons: [], // Default hidden buttons
        disabledButtons: [], // Default disabled buttons
        footer: '',
        fullscreen: {
            enable: true,
            icons: {
                fullscreenOn: {
                    fa: 'fa fa-expand',
                    glyph: 'glyphicon glyphicon-fullscreen',
                    'fa-3': 'icon-resize-full'
                },
                fullscreenOff: {
                    fa: 'fa fa-compress',
                    glyph: 'glyphicon glyphicon-fullscreen',
                    'fa-3': 'icon-resize-small'
                }
            }
        },

        /* Events hook */
        onShow: function (e) {
        },
        onPreview: function (e) {
        },
        onSave: function (e) {
        },
        onBlur: function (e) {
        },
        onFocus: function (e) {
        },
        onChange: function (e) {
        },
        onFullscreen: function (e) {
        }
    };

    $.fn.markdown.Constructor = Markdown;


    /* MARKDOWN NO CONFLICT
     * ==================== */

    $.fn.markdown.noConflict = function () {
        $.fn.markdown = old;
        return this;
    };

    /* MARKDOWN GLOBAL FUNCTION & DATA-API
     * ==================================== */
    var initMarkdown = function (el) {
        var $this = el;

        if ($this.data('markdown')) {
            $this.data('markdown').showEditor();
            return;
        }

        $this.markdown()
    };

    var blurNonFocused = function (e) {
        var $activeElement = $(document.activeElement);

        // Blur event
        $(document).find('.md-editor').each(function () {
            var $this = $(this),
                focused = $activeElement.closest('.md-editor')[0] === this,
                attachedMarkdown = $this.find('textarea').data('markdown') ||
                    $this.find('div[data-provider="markdown-preview"]').data('markdown');

            if (attachedMarkdown && !focused) {
                attachedMarkdown.blur();
            }
        })
    };

    $(document)
        .on('click.markdown.data-api', '[data-provide="markdown-editable"]', function (e) {
            initMarkdown($(this));
            e.preventDefault();
        })
        .on('click focusin', function (e) {
            blurNonFocused(e);
        })
        .ready(function () {
            $('textarea[data-provide="markdown"]').each(function () {
                initMarkdown($(this));
            })
        });

}(window.jQuery);
// Source: public/javascripts/vendor/markdown/locale/bootstrap-markdown.ar.js
/*
 * Arabic translation for bootstrap-markdown
 * George Ajam <george.ejaam@gmail.com>
 */
(function ($) {
    $.fn.markdown.messages.nl = {
        'Bold': "غامق",
        'Italic': "مائل",
        'Heading': "عنوان",
        'URL/Link': "URL/رابط",
        'Image': "صورة",
        'List': "قائمة",
        'Preview': "استعراض",
        'strong text': "نص غامق",
        'emphasized text': "نص هام",
        'heading text': "العنوان",
        'enter link description here': "ادخل وصف الرابط هنا",
        'Insert Hyperlink': "ادخل الرابط هنا",
        'enter image description here': "ادخل وصف الصورة هنا",
        'Insert Image Hyperlink': "ادخل رابط الصورة هنا",
        'enter image title here': "ادخل عنوان الصورة هنا",
        'list text here': "اكتب النص هنا"
    };
}(jQuery));
// Source: public/javascripts/vendor/markdown/locale/bootstrap-markdown.de.js
/**
 * German translation for bootstrap-markdown
 * Tobias Nitsche <tobias-nitsche@gmx.net>
 */
(function ($) {
    $.fn.markdown.messages.de = {
        'Bold': "Fett",
        'Italic': "Kursiv",
        'Heading': "Überschrift",
        'URL/Link': "Link hinzufügen",
        'Image': "Bild hinzufügen",
        'Unordered List': "Unnumerierte Liste",
        'Ordered List': "Numerierte Liste",
        'Code': "Quelltext",
        'Quote': "Zitat",
        'Preview': "Vorschau",
        'strong text': "Sehr betonter Text",
        'emphasized text': "Betonter Text",
        'heading text': "Überschrift Text",
        'enter link description here': "Linkbeschreibung",
        'Insert Hyperlink': "URL",
        'enter image description here': "Bildbeschreibung",
        'Insert Image Hyperlink': "Bild-URL",
        'enter image title here': "Titel des Bildes",
        'list text here': "Aufzählungs-Text"
    };
}(jQuery));

// Source: public/javascripts/vendor/markdown/locale/bootstrap-markdown.es.js
/**
 * Spanish translation for bootstrap-markdown
 * by Leandro Poblet <leandrodrhouse@gmail.com>
 */
(function ($) {
    $.fn.markdown.messages.es = {
        'Bold': "Negrita",
        'Italic': "Itálica",
        'Heading': "Título",
        'URL/Link': "Inserte un link",
        'Image': "Inserte una imagen",
        'List': "Lista de items",
        'Preview': "Previsualizar",
        'strong text': "texto importante",
        'emphasized text': "texto con énfasis",
        'heading text': "texto titular",
        'enter link description here': "descripción del link",
        'Insert Hyperlink': "Inserte un hipervínculo",
        'enter image description here': "descripción de la imagen",
        'Insert Image Hyperlink': "Inserte una imagen con un hipervínculo",
        'enter image title here': "Inserte una imagen con título",
        'list text here': "lista con texto"
    };
}(jQuery));

// Source: public/javascripts/vendor/markdown/locale/bootstrap-markdown.fr.js
/**
 * French translation for bootstrap-markdown
 * Benoît Bourgeois <bierdok@gmail.com>
 */
(function ($) {
    $.fn.markdown.messages.fr = {
        'Bold': "Gras",
        'Italic': "Italique",
        'Heading': "Titre",
        'URL/Link': "Insérer un lien HTTP",
        'Image': "Insérer une image",
        'List': "Liste à puces",
        'Preview': "Prévisualiser",
        'strong text': "texte important",
        'emphasized text': "texte souligné",
        'heading text': "texte d'entête",
        'enter link description here': "entrez la description du lien ici",
        'Insert Hyperlink': "Insérez le lien hypertexte",
        'enter image description here': "entrez la description de l'image ici",
        'Insert Image Hyperlink': "Insérez le lien hypertexte de l'image",
        'enter image title here': "entrez le titre de l'image ici",
        'list text here': "texte à puce ici"
    };
}(jQuery));

// Source: public/javascripts/vendor/markdown/locale/bootstrap-markdown.ja.js
/**
 * Japanese translation for bootstrap-markdown
 * Kenta Murakami <kntmrkm@gmail.com>
 */
(function ($) {
    $.fn.markdown.messages.ja = {
        'Bold': "太字",
        'Italic': "斜体",
        'Heading': "見出し",
        'URL/Link': "リンク",
        'Image': "画像",
        'Unordered List': "リスト",
        'Ordered List': "数字リスト",
        'Code': "コード",
        'Quote': "引用",
        'Preview': "プレビュー",
        'strong text': "太字",
        'emphasized text': "強調",
        'heading text': "見出し",
        'enter link description here': "リンク説明",
        'Insert Hyperlink': "リンク挿入",
        'enter image description here': "画像説明",
        'Insert Image Hyperlink': "画像挿入",
        'enter image title here': "画像タイトル",
        'list text here': "リスト挿入",
        'code text here': "コード",
        'quote here': "引用挿入"
    };
}(jQuery));
// Source: public/javascripts/vendor/markdown/locale/bootstrap-markdown.kr.js
/**
 + * Korean translation for bootstrap-markdown
 + * WoongBi Kim <ssinss@gmail.com>
 + */
(function ($) {
    $.fn.markdown.messages.kr = {
        'Bold': "진하게",
        'Italic': "이탤릭체",
        'Heading': "머리글",
        'URL/Link': "링크주소",
        'Image': "이미지",
        'List': "리스트",
        'Preview': "미리보기",
        'strong text': "강한 강조 텍스트",
        'emphasized text': "강조 텍스트",
        'heading text': "머리글 텍스트",
        'enter link description here': "여기에 링크의 설명을 적으세요",
        'Insert Hyperlink': "하이퍼링크 삽입",
        'enter image description here': "여기세 이미지 설명을 적으세요",
        'Insert Image Hyperlink': "이미지 링크 삽입",
        'enter image title here': "여기에 이미지 제목을 적으세요",
        'list text here': "리스트 텍스트"
    };
}(jQuery));

// Source: public/javascripts/vendor/markdown/locale/bootstrap-markdown.nb.js
/**
 * Norwegian bokmål translation for bootstrap-markdown
 * Tobias Bohwalli <hi@futhr.io>
 */
;(function ($) {
    $.fn.markdown.messages.nb = {
        'Bold': 'Fet',
        'Italic': 'Kursiv',
        'Heading': 'Overskrift',
        'URL/Link': 'URL/Lenke',
        'Image': 'Bilde',
        'List': 'Liste',
        'Preview': 'Forhåndsvisning',
        'strong text': 'sterk tekst',
        'emphasized text': 'streket tekst',
        'heading text': 'overskriften tekst',
        'enter link description here': 'Skriv linken beskrivelse her',
        'Insert Hyperlink': 'Sett inn lenke',
        'enter image description here': 'Angi bildebeskrivelse her',
        'Insert Image Hyperlink': 'Sett inn lenke for bilde',
        'enter image title here': 'Angi bildetittel her',
        'list text here': 'liste tekst her'
    };
}(jQuery));

// Source: public/javascripts/vendor/markdown/locale/bootstrap-markdown.nl.js
/**
 * Dutch translation for bootstrap-markdown
 * Jeroen Thora <jeroenthora@gmail.com>
 */
(function ($) {
    $.fn.markdown.messages.nl = {
        'Bold': "Vet",
        'Italic': "Cursief",
        'Heading': "Titel",
        'URL/Link': "URL/Link",
        'Image': "Afbeelding",
        'List': "Lijst",
        'Preview': "Voorbeeld",
        'strong text': "vet gedrukte tekst",
        'emphasized text': "schuin gedrukte tekst",
        'heading text': "Titel",
        'enter link description here': "Voer een link beschrijving in",
        'Insert Hyperlink': "Voer een http link in",
        'enter image description here': "Voer een afbeelding beschrijving in",
        'Insert Image Hyperlink': "Voer een afbeelding link in",
        'enter image title here': "Voer de afbeelding titel in",
        'list text here': "lijst item"
    };
}(jQuery));

// Source: public/javascripts/vendor/markdown/locale/bootstrap-markdown.pl.js
/**
 * Polish translation for bootstrap-markdown
 * Marek Kaput
 */
(function ($) {
    $.fn.markdown.messages.pl = {
        'Bold': "Pogrubienie",
        'Italic': "Kursywa",
        'Heading': "Nagłówek",
        'URL/Link': "Wstaw link",
        'Image': "Wstaw obrazek",
        'Unordered List': "Lista punktowana",
        'Ordered List': "Lista numerowana",
        'Code': "Kod źródłowy",
        'Quote': "Cytat",
        'Preview': "Podgląd",
        'strong text': "pogrubiony tekst",
        'emphasized text': "pochylony tekst",
        'heading text': "nagłówek",
        'enter link description here': "opis linka",
        'Insert Hyperlink': "Wstaw link",
        'enter image description here': "opis obrazka",
        'Insert Image Hyperlink': "Wstaw obrazek",
        'enter image title here': "tytuł obrazka",
        'list text here': "lista"
    };
}(jQuery));

// Source: public/javascripts/vendor/markdown/locale/bootstrap-markdown.ru.js
/**
 * Russian translation for bootstrap-markdown
 * by Oleg Vivtash <o@vivtash.net>
 */
(function ($) {
    $.fn.markdown.messages.ru = {
        'Bold': "Жирный",
        'strong text': "выделенный текст",
        'Italic': "Курсив",
        'emphasized text': "наклонный текст",
        'Heading': "Заголовок",
        'heading text': "текст заголовка",
        'URL/Link': "Вставьте ссылку",
        'Insert Hyperlink': "Введите гиперссылку",
        'enter link description here': "введите описание ссылки",
        'Image': "Изображение",
        'enter image description here': "Введите описание изображения",
        'Insert Image Hyperlink': "Вставьте ссылку на изображение",
        'enter image title here': "Введите название изображения",
        'List': "Список",
        'Unordered List': "Неупорядоченный список",
        'Ordered List': "Упорядоченный список",
        'list text here': "текст списка",
        'Code': "Код",
        'code text here': "программный код",
        'Quote': "Цитата",
        'quote here': "цитируемый текст",
        'Preview': "Предварительный просмотр"
    };
}(jQuery));

// Source: public/javascripts/vendor/markdown/locale/bootstrap-markdown.sv.js
/**
 * Swedish translation for bootstrap-markdown
 * Tobias Bohwalli <hi@futhr.io>
 */
(function ($) {
    $.fn.markdown.messages.sv = {
        'Bold': 'Fet',
        'Italic': 'Kursiv',
        'Heading': 'Rubrik',
        'URL/Link': 'URL/Länk',
        'Image': 'Bild',
        'List': 'Lista',
        'Preview': 'Förhandsgranska',
        'strong text': 'fet text',
        'emphasized text': 'överstruken text',
        'heading text': 'Rubrik',
        'enter link description here': 'Ange länk beskrivning här',
        'Insert Hyperlink': 'Sätt in länk',
        'enter image description here': 'Ange bild beskrivning här',
        'Insert Image Hyperlink': 'Sätt in länk för bild',
        'enter image title here': 'Ange bild rubrik här',
        'list text here': 'list text'
    };
}(jQuery));

// Source: public/javascripts/vendor/markdown/locale/bootstrap-markdown.tr.js
/**
 * Turkish translation for bootstrap-markdown
 * Serkan Algur <info@wpadami.com>
 */
(function ($) {
    $.fn.markdown.messages.tr = {
        'Bold': "Kalın",
        'Italic': "İtalik",
        'Heading': "Başlık",
        'URL/Link': "Link ekle",
        'Image': "Resim ekle",
        'List': "Liste Oluşturun",
        'Preview': "Önizleme",
        'strong text': "kalın yazı",
        'emphasized text': "italik yazı",
        'heading text': "Başlık Yazısı",
        'enter link description here': "Link açıklamasını buraya girin",
        'Insert Hyperlink': "İnternet adresi girin",
        'enter image description here': "resim açıklamasını buraya ekleyin",
        'Insert Image Hyperlink': "Resim linkini ekleyin",
        'enter image title here': "resim başlığını buraya ekleyin",
        'list text here': "liste yazısı",
        'Save': "Kaydet",
        'Ordered List': "Numaralı Liste",
        'Unordered List': "Madde imli liste",
        'Quote': "Alıntı",
        'quote here': "alıntıyı buraya ekleyin",
        'Code': "Kod",
        'code text here': "kodu buraya ekleyin"
    };
}(jQuery));

// Source: public/javascripts/vendor/markdown/locale/bootstrap-markdown.ua.js
/**
 * Ukrainian translation for bootstrap-markdown
 * by Oleg Vivtash <o@vivtash.net>
 */
(function ($) {
    $.fn.markdown.messages.ua = {
        'Bold': "Жирний",
        'Italic': "Курсів",
        'Heading': "Заголовок",
        'URL/Link': "Вставте посилання",
        'Image': "Зображення",
        'List': "Список",
        'Preview': "Попередній перегляд",
        'strong text': "виділений текст",
        'emphasized text': "нахилений текст",
        'heading text': "текст заголовку",
        'enter link description here': "введіть опис посилання",
        'Insert Hyperlink': "Введіть гіперпосилання",
        'enter image description here': "Введіть опис зображення",
        'Insert Image Hyperlink': "Вставте посилання на зображення",
        'enter image title here': "Введіть назву зображення",
        'list text here': "текст списку"
    };
}(jQuery));

// Source: public/javascripts/vendor/markdown/locale/bootstrap-markdown.zh.js
/**
 * Chinese translation for bootstrap-markdown
 * benhaile <denghaier@163.com>
 */
(function ($) {
    $.fn.markdown.messages['zh'] = {
        'Bold': "粗体",
        'Italic': "斜体",
        'Heading': "标题",
        'URL/Link': "链接",
        'Image': "图片",
        'List': "列表",
        'Unordered List': "无序列表",
        'Ordered List': "有序列表",
        'Code': "代码",
        'Quote': "引用",
        'Preview': "预览",
        'strong text': "粗体",
        'emphasized text': "强调",
        'heading text': "标题",
        'enter link description here': "输入链接说明",
        'Insert Hyperlink': "URL地址",
        'enter image description here': "输入图片说明",
        'Insert Image Hyperlink': "图片URL地址",
        'enter image title here': "在这里输入图片标题",
        'list text here': "这里是列表文本",
        'code text here': "这里输入代码",
        'quote here': "这里输入引用文本",
        'Cancle': "取消",
        'Insert':'插入',
        'ImageTip':'本地图片仅支持JPG、GIF、PNG格式,并且文件小于512Kb(1kb=1024字节).网络图片地址以http://、https://或ftp://格式开头',
        'ImageInputTip':'请填入网络图片地址或点击按钮上传本地图片到服务器.',
        'BrowerSupportTip':'你的浏览器不被支持(IE10+)!',
        'Progress':'上传进度',
        'ProgressLoaded':'上传完成',
        'UploadPathTip':'未设置文件上传路径!',
        'UploadEooroTip':'上传出错',
        'SupportTypeTip':'仅支持JPG、GIF和PNG图片文件!',
        'FileSizeTip':'上传文件不能大于512Kb!'

    };
}(jQuery));
