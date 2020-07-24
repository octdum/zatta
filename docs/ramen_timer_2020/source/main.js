var wordData = {
    "main": {
        "name" : "アクター",
        "desc" : "末尾に1つ記述(必須)",
        "type" : "time",
        "words": [
            { "word": "ラーメン", "time": 180 },
            { "word": "ヤキソバ", "time": 120 },
            { "word": "ウドン", "time": 300 }
        ],
        "next": ["katasa", "press"]
    },
    "press": {
        "name": "アッシュク",
        "desc": "「アクター」の前に記述(1つ以上必須)",
        "type": "none",
        "words": [
            { "word": "インスタント" },
            { "word": "カップ" },
            { "word": "ソクセキ" }
        ],
        "next": ["katasa", "press", null]
    },
    "katasa": {
        "name": "カタサ",
        "desc": "硬さを調整したい「アッシュク」の後ろに記述(任意)",
        "type": "rate",
        "words": [
            { "word": "カキアゲ", "rate": 0.02 },
            { "word": "ハリガネ", "rate": 0.17 },
            { "word": "バリカタ", "rate": 0.25 },
            { "word": "カタメ", "rate": 0.50 },
            { "word": "ヤワメ", "rate": 1.30 },
            { "word": "ズンダレ", "rate": 1.67 }
        ],
        "next": ["press"]
    }
};

// 値の制限 (static)
Math.clamp = function (value, min, max) {
    return (min > value) ? min : (max < value ? max : value);
};

if (!Math.sign) {
    Math.sign = function (x) {
        return ((x > 0) - (x < 0)) || +x;
    };
}

// 光速
Math.SPEED_OF_LIGHT = 299792458 * 3600 / 1000;

// ローレンツ因子
Math.lorentzFactor = function (speed) {
    if (this.abs(speed) >= this.SPEED_OF_LIGHT) return Infinity;
    return 1 / this.sqrt(1 - this.pow(speed / this.SPEED_OF_LIGHT, 2));
}

// 相対速度による時間スケール
// (負数である場合、自身が加速系である)
Math.timeScaleFromSpeed = function (speed) {
    return (this.sign(speed) >= 0) ? 1 / this.lorentzFactor(speed) : this.lorentzFactor(speed);
}

// 0埋め (static)
String.prototype.padding0 = function (count) {
    return ('000000000000' + this).slice(-count);
}

if (!String.prototype.endsWith) {
    String.prototype.endsWith = function (search, this_len) {
        if (this_len === undefined || this_len > this.length) {
            this_len = this.length;
        }
        return this.substring(this_len - search.length, this_len) === search;
    };
}

String.prototype.ToKatakana = function() {
    return this.replace(/[\u3041-\u3096]/g, function (match) {
        let chr = match.charCodeAt(0) + 0x60;
        return String.fromCharCode(chr);
    });
}

function Time() {
    throw new Error("Don't make this class.");
}

Time.beforeTimeStamp = 0;

Time.Reset = function () {
    this.beforeTimeStamp = new Date().getTime();
};

Time.DeltaTime = function () {
    let t = this.beforeTimeStamp;
    this.beforeTimeStamp = new Date().getTime();
    return (this.beforeTimeStamp - t) / 1000.0;
};


// Application
function Application() {
    this.element = new Element();
    this.loopMethod = -1;
    this.IsPlaying = false;

    this.timeScale = 1.0;

    this.setTime = 0.0;
    this.currentTime = 0.0;

    this.recipe = {};
    this.currentRecipeIndex = 0;

    this.titleChangeTimer    = 0.0;
    this.titleChangeInterval = 1.0;

    this.fps = 20;

    this.TimerSet();
    this.element.SetAllWordListHTML(wordData);
}

Application.prototype.AwakeLoop = function () {
    if (this.loopMethod >= 0) return;

    this.loopMethod = setTimeout(this.Loop.bind(this), 1 / this.fps * 1000);
    Time.Reset();
}

Application.prototype.Loop = function () {
    this.Update(Time.DeltaTime());

    if (this.loopMethod >= 0) {
        this.loopMethod = setTimeout(this.Loop.bind(this), 1 / this.fps * 1000);
    }
}

Application.prototype.FinishLoop = function () {
    if (this.loopMethod < 0) return;
    this.Update(Time.DeltaTime());

    clearTimeout(this.loopMethod);
    this.loopMethod = -1;
}

Application.prototype.Update = function (deltaTime) {
    this.currentTime -= (deltaTime > 0) ? (deltaTime * this.timeScale) : 0; // Infinity * 0 = NaN 対策
    if (this.currentTime < 0) {
        this.currentTime = 0;
        this.FinishTimer();
    }

    this.titleChangeTimer -= deltaTime;
    if (this.titleChangeTimer <= 0) {
        this.titleChangeTimer = this.titleChangeInterval;
        this.element.SetTitleTime(this.currentTime);
    }

    this.RecipeUpdate();

    this.element.TimerUpdate(this.currentTime);
}

Application.prototype.RecipeUpdate = function () {
    let i;
    for (i = this.currentRecipeIndex + 1; i < this.recipe.length; i++) {
        let nextRecipe = this.recipe[(this.recipe.length - 1) - i];
        if (this.currentTime > nextRecipe.totalTime) {
            break;
        }
    }
    i--;
    if (this.currentRecipeIndex != i) {
        this.currentRecipeIndex = i;
        this.element.ChangeActiveRecipeItem(this.currentRecipeIndex);
    }
}

Application.prototype.SetFps = function (fps) {
    this.fps = Math.clamp(fps, 1, 60);
}

Application.prototype.TimerStart = function () {
    if (this.IsPlaying) return;
    if (this.currentTime <= 0) return;
    this.IsPlaying = true;

    if (this.currentTime == this.setTime) {
        this.element.PlayTimerStartSound();
    }

    this.element.SetTitleTime(this.currentTime);
    this.element.TimerStart();
    this.AwakeLoop();
}

Application.prototype.TimerPause = function () {
    if (!this.IsPlaying) return;
    this.IsPlaying = false;

    this.FinishLoop();

    this.element.SetTitleTime(this.currentTime);
    this.element.TimerPause();
}

Application.prototype.TimerSet = function () {
    this.TimerPause();
    var recipe = this.MakeRecipe(this.element.GetRamenName(), this.element.GetIntervalTime(), this.element.IsKatasaInherit());
    if (recipe == null) return;
    this.recipe = recipe;
    this.currentRecipeIndex = 0;

    this.setTime = this.recipe[this.recipe.length - 1].totalTime;
    this.currentTime = this.setTime;

    this.timeScale = Math.timeScaleFromSpeed(this.element.GetRamenSpeed());

    this.element.SetTitleTime(this.currentTime);
    this.element.SetRecipeList(this.recipe);
    this.element.SetTimelag(this.currentTime * (1 / this.timeScale) - this.currentTime);
    this.element.TimerSet(this.setTime);
    this.element.ClearErrorLog();
}

// タイマーが終了した時の処理
Application.prototype.FinishTimer = function () {
    this.TimerPause();

    this.element.SetTitleFinish();
    this.element.PlayTimerFinishSound();
}

// レシピを作成して配列で返す
Application.prototype.MakeRecipe = function (str, intervalTime, isAdjustInherit) {
    let ret = [];
    let nextType = ['main'];
    let strLength = str.length;
    let currentItem = null;
    let baseTime = 0;

    while (true) {
        let isFindType = false;
        for (let i = 0; i < nextType.length; i++) {
            let type = nextType[i];
            if (type == null) {
                if (strLength == 0) {
                    // 終了
                    return ret;
                }
                break;
            }

            let r = this.EndsWithWordArray(str, wordData[type].words, strLength);
            if (r == null) {
                continue;
            }
            // 一致単語発見
            if (type == 'main') {
                baseTime = r.time;
                currentItem = {
                    type: 0,
                    make: r.word,
                    katasa: '',
                    time: baseTime,
                    totalTime: 0
                };
                ret.push(currentItem);
            }

            if (type == 'katasa') {
                currentItem.katasa = r.word;
                currentItem.time *= r.rate;
            }

            if (type == 'press') {
                // インスタント追加
                currentItem = {
                    type: 0,
                    make: r.word + currentItem.katasa + currentItem.make,
                    katasa: '',
                    time: isAdjustInherit ? currentItem.time : baseTime,
                    totalTime: ret[ret.length - 1].totalTime + currentItem.time,
                };

                if (currentItem.time < 0.000000000001) {
                    this.element.SetErrorLog("ERROR! : 1工程が1ピコ秒未満のカチカチラーメンを作らないでください");
                    return null;
                }

                if (currentItem.totalTime > (1000 * 365.2425 * 86400)) {
                    this.element.SetErrorLog("ERROR! : 1000年以上かけて超大作ラーメンを作らないでください");
                    return null;
                }

                ret.push(currentItem);

                if (intervalTime > 0) {
                    // お湯入れる時間
                    ret.push({
                        type: 1,
                        totalTime: currentItem.totalTime + intervalTime
                    });
                }

                if (ret.length > 200) {
                    this.element.SetErrorLog("ERROR! : 200工程以上手間をかけてラーメンを作らないでください");
                    return null;
                }
            }

            nextType = wordData[type].next;
            isFindType = true;
            strLength -= r.word.length;
            break;
        }

        if (!isFindType) {
            this.element.SetErrorLog("ERROR! : 文法が間違ってるっぽいです");
            return null;
        }
    }
}

Application.prototype.EndsWithWordArray = function (word, searches, length) {
    for (let i = 0; i < searches.length; i++) {
        if (word.endsWith(searches[i].word, length)) {
            return searches[i];
        }
    }
    return null;
}

// SETボタンが押されたイベント
Application.prototype.OnPushedTimerSet = function () {
    this.TimerSet(this.element.GetRamenName());
}

// START / PAUSEボタンが押されたイベント
Application.prototype.OnPushedTimerAction = function () {
    if (!this.IsPlaying) {
        this.TimerStart();
    } else {
        this.TimerPause();
    }
}


// Element
function Element() {
    this.iRamenName = this.GetElement("input_ramen_name");
    this.iTimerInterval = this.GetElement("input_timer_interval");
    this.iTimerSound = this.GetElement("input_timer_sound");
    this.iRecipeKatasa = this.GetElement("input_recipe_katasa_inhelit");
    this.iTimerControllAction = this.GetElement("input_timer_controll_action");
    this.iRamenSpeed = this.GetElement("input_ramen_speed");

    this.oTimeN = this.GetElement("output_time_n");
    this.oTimeM = this.GetElement("output_time_m");
    this.oTimeLength = this.GetElement("output_time_length");
    this.oRecipe = this.GetElement("output_recipe");
    this.oError = this.GetElement("output_error");
    this.oErrorInfo = this.GetElement("output_error_info");
    this.oRecipeProgress = this.GetElement("output_recipe_progress");
    this.oRecipeLength = this.GetElement("output_recipe_length");
    this.oTimelag = this.GetElement("output_timelag");

    this.oWordList = this.GetElement("output_word_list");

    this.aTimerStart = this.GetElement("audio_timer_start");
    this.aTimerFinish = this.GetElement("audio_timer_finish");

    this.oRecipeItems = null;

    this.currentRecipeIndex = 0;
}

// ラーメンの名前を取得
Element.prototype.GetRamenName = function () {
    if (this.iRamenName.value == '') {
        return this.iRamenName.placeholder;
    }
    return this.iRamenName.value.ToKatakana();
}

Element.prototype.IsKatasaInherit = function () {
    return this.iRecipeKatasa.checked;
}

Element.prototype.GetIntervalTime = function () {
    let value = Math.clamp(Number(this.iTimerInterval.value), 0, 30);
    this.iTimerInterval.value = value;
    return value;
}

Element.prototype.GetRamenSpeed = function () {
    let value = Math.clamp(Number(this.iRamenSpeed.value), -Math.SPEED_OF_LIGHT, Math.SPEED_OF_LIGHT);
    this.iRamenSpeed.value = value;
    return value;
}

// タイマーがセットされたときの表示更新
Element.prototype.TimerSet = function (time) {
    this.oTimeLength.innerText = this.GetTimeString(time);
    this.TimerUpdate(time);
}

// タイマーの表示更新
Element.prototype.TimerUpdate = function (time) {
    this.oTimeN.innerText = this.GetTimeStringS(time);
    this.oTimeM.innerText = this.GetTimeStringMS(time);
}

// タイマーがスタートしたときの表示更新
Element.prototype.TimerStart = function () {
    this.iTimerControllAction.value = "PAUSE";
}

// タイマーが一時停止したときの表示更新
Element.prototype.TimerPause = function () {
    this.iTimerControllAction.value = "START";
}

Element.prototype.SetRecipeList = function (recipe) {
    var res = '';

    for (let i = recipe.length - 1; i >= 0; i--) {
        let desc = "";
        if (recipe[i].type == 0) {
            if (i == 0) {
                desc = "「" + recipe[i].katasa + recipe[i].make + "」の完成です";
            } else {
                desc = "「" + recipe[i].make + "」を作ります";
            }
        } else {
            desc = "「" + recipe[i - 1].make + "」にお湯を入れます"
        }
        res += this.GetRecipeItemHTML(recipe[i].totalTime, desc);
    }
    this.oRecipe.innerHTML = res;

    this.oRecipeItems = document.getElementsByClassName("recipe_item");

    this.currentRecipeIndex = 0;
    this.ChangeActiveRecipeItem(this.currentRecipeIndex);
    this.SetRecipeLength(recipe.length);
}

Element.prototype.GetRecipeItemHTML = function (time, desc) {
    return '<div class="recipe_item">' +
        '<div class="recipe_time">' + this.GetTimeString(time) + '</div>' +
        '<div class="recipe_desc">' + desc + '</div>' +
        '</div>';
}

Element.prototype.ChangeActiveRecipeItem = function (index) {
    this.oRecipeItems[this.currentRecipeIndex].className = 'recipe_item';
    this.currentRecipeIndex = index;
    this.oRecipeItems[this.currentRecipeIndex].classList.add('recipe_t');
    this.SetRecipeProgress(index);
}

Element.prototype.SetRecipeLength = function (value) {
    this.oRecipeLength.innerText = value.toString();
}

Element.prototype.SetRecipeProgress = function (value) {
    this.oRecipeProgress.innerText = (value + 1).toString();
}

// 「計測地点との時間差」の表示変更
Element.prototype.SetTimelag = function (time) {
    this.oTimelag.style.display = (time == 0) ? 'none' : 'block';
    this.oTimelag.innerText = "(計測地点との時間差 : " + this.GetShortTimeString(time) + ")";
}

// エラーログの非表示
Element.prototype.ClearErrorLog = function () {
    this.oError.style.display = 'none';
}

// エラーログの表示
Element.prototype.SetErrorLog = function (str) {
    this.oError.style.display = 'block';
    this.oErrorInfo.innerText = str;
}

// 時間を「○分○秒」形式の文字列に変換
Element.prototype.GetShortTimeString = function (time, second = true) {
    const yt = 365.2425 * 86400;
    let s = (time < 0 && second) ? '-' : '' ;

    if (time < 0) time = Math.abs(time);
    if (time == Infinity) return s + '∞';

    if (time >= yt) {
        // y
        return s + Math.floor(time / yt).toString() + '年' +
            (second ? this.GetShortTimeString(time % yt, false) : '');
    }
    if (time >= 86400) {
        // d
        return s + Math.floor(time / 86400).toString() + '日' +
            (second ? this.GetShortTimeString(time % 86400, false) : '');
    }
    if (time >= 3600) {
        // h
        return s + Math.floor(time / 3600).toString() + '時間' +
            (second ? this.GetShortTimeString(time % 3600, false) : '');
    }
    if (time >= 60) {
        // m
        return s + Math.floor(time / 60).toString() + '分' +
            (second ? this.GetShortTimeString(time % 60, false) : '');
    }
    if (time >= 1) {
        // s
        return s + Math.floor(time).toString() + '秒';
    }
    if (!second) return '';
    if (time >= 0.001) {
        // ms
        return s + Math.floor(time * 1000).toString() + 'ミリ秒';
    }
    if (time >= 0.000001) {
        // μs
        return s + Math.floor(time * 1000000).toString() + 'マイクロ秒';
    }
    if (time >= 0.000000001) {
        // ns
        return s + Math.floor(time * 1000000000).toString() + 'ナノ秒';
    }
    if (time >= 0.000000000001) {
        // ps
        return s + Math.floor(time * 1000000000000).toString() + 'ピコ秒';
    }
    if (time >= Number.MIN_VALUE) {
        return ((s == '-') ? '> -' : '< ' ) + '1ピコ秒';
    }
    return '0秒';
}

// 時間を表示用の文字列に変換
Element.prototype.GetTimeString = function (time) {
    return this.GetTimeStringS(time) + this.GetTimeStringMS(time);
}

// 時間を表示用の文字列に変換(ミリ秒のみ)
Element.prototype.GetTimeStringMS = function (time) {
    return '.' + Math.floor(time * 1000 % 1000).toString().padding0(3);
}

// 時間を表示用の文字列に変換(ミリ秒を除く)
Element.prototype.GetTimeStringS = function (time) {
    return '' +
        (time > 3600 ? Math.floor(time / 3600).toString() + ':' : '') +
        Math.floor((time % 3600) / 60).toString().padding0(time < 600 ? 1 : 2) + ':' +
        Math.floor(time % 60).toString().padding0(2);
}

// HTMLの要素を取得
Element.prototype.GetElement = function (str) {
    return document.getElementById(str);
}

// 
Element.prototype.CanPlayAudio = function () {
    return this.iTimerSound.checked;
}

Element.prototype.PlayTimerStartSound = function () {
    if (!this.CanPlayAudio()) return;
    this.aTimerStart.play();
}

Element.prototype.PlayTimerFinishSound = function () {
    if (!this.CanPlayAudio()) return;
    this.aTimerFinish.play();
}

Element.prototype.SetAllWordListHTML = function(wordData) {
    let str = '';

    str += '<li>' + this.MakeWordListHTML(wordData.main)   + '</li>';
    str += '<li>' + this.MakeWordListHTML(wordData.press)  + '</li>';
    str += '<li>' + this.MakeWordListHTML(wordData.katasa) + '</li>';

    this.oWordList.innerHTML = str;
}

Element.prototype.MakeWordListHTML = function (wordTypeData) {
    let ret = '';
    ret += '<b>' + wordTypeData.name + '</b> : ' + wordTypeData.desc;
    ret += '<ul>';
    for (let i = 0; i < wordTypeData.words.length; i++) {
        let item = wordTypeData.words[i];
        ret += '<li>' + this.MakeWordHTML(item, wordTypeData.type) + '</li>';
    }
    ret += '</ul>';
    return ret;
}

Element.prototype.MakeWordHTML = function (word, type) {
    let effect = '';
    switch (type) {
        case 'time':
            effect = ' ( ' + this.GetShortTimeString(word.time) + ' )';
            break;
        case 'rate':
            effect = ' ( ' + this.GetRateString(word.rate) + ' )';
            break;
    }

    return word.word + effect;
}

// 倍率な数値をパーセンテージな文字列に変換
Element.prototype.GetRateString = function (rate) {
    if (rate == 1) return '±0%';
    if (Math.abs(rate - 1) < 0.01) {
        return (rate < 0 ? '> -' : '< +') + '1%';
    }

    rate = Math.floor(rate * 100) - 100;
    return (rate > 0 ? '+' : '') + rate.toString() + '%';
} 

Element.prototype.SetTitleTime = function (time) {
    document.title = this.GetShortTimeString(time) + ' - ラーメンタイマー -2020ver-';
}

Element.prototype.SetTitleFinish = function () {
    document.title = 'ラーメン完成！！！';
}

// global method
application = new Application();