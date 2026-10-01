/** 第一章《圆滚滚村的骚动》剧情对话数据 */

export interface DialogLine {
  speaker: string;
  text: string;
}

export const DIALOGS: Record<string, DialogLine[]> = {
  elderIntro: [
    { speaker: "宇航", text: "哦哦，你就是新搬来的小家伙吧！听说你也领养了自己的宠物。" },
    { speaker: "宇航", text: "不瞒你说，最近村里怪事不断——夜里有黑影偷吃大家的点心，鸡皮疙瘩都吓圆了！" },
    { speaker: "宇航", text: "有人看见那些黑影往东边的风铃草原跑了。你愿意带着宠物去看看吗？" },
    { speaker: "宇航", text: "出门前记得找胖婶备点奶瓶！东村的门我已经给你开啦。" },
  ],
  villagerChat: [
    { speaker: "村民小豆", text: "听说东边草原上有会发光的圆影子……你要是碰上了，可千万别怂！" },
    { speaker: "村民小豆", text: "打赢野生的胖胖能捡到金币哦，这是村里人尽皆知的小秘密。" },
  ],
  shopGreeting: [
    { speaker: "胖婶商店", text: "哎哟，小勇士来啦！奶瓶管够，衣服也漂亮得很，随便挑～" },
  ],
  meadowEvent: [
    { speaker: "旅人小圆", text: "你就是村里的新人对吧？我叫小圆，是来调查黑影事件的旅人。" },
    { speaker: "旅人小圆", text: "我在草原那边看到了——那些黑影钻进东边的迷雾森林了！可是森林入口被荆棘挡住了……" },
    { speaker: "旅人小圆", text: "我用我的小刀给你砍开了入口，剩下的路你替我走下去吧！" },
    { speaker: "旅人小圆", text: "对了，这几瓶大奶瓶你拿着，森林里的胖胖可比草原的凶多了。" },
  ],
  guardPre: [
    { speaker: "大狗粪", text: "站住！想出村，先证明你有保护自己的实力！" },
    { speaker: "大狗粪", text: "别紧张，就是切磋一场——赢了我，全村都认你！" },
  ],
  guardWin: [
    { speaker: "大狗粪", text: "好厉害！以后出村我第一个放行！这点心意收下吧。" },
  ],
  guardLose: [
    { speaker: "大狗粪", text: "哈哈，回家练练再来找我吧，我随时奉陪！" },
  ],
  bossIntro: [
    { speaker: "？？？？", text: "呜呜……又有谁来了……" },
    { speaker: "暗影胖胖王", text: "我是森林的大胖胖，因为太圆太黑，被大家当成了怪物……" },
    { speaker: "暗影胖胖王", text: "想让我信你？先打赢我！！" },
  ],
  bossWin: [
    { speaker: "暗影胖胖王", text: "呜哇，你好强……呜呜，其实我只是想有人陪我玩。" },
    { speaker: "暗影胖胖王", text: "偷吃点心的事对不起啦，我请大家吃森林果子赔罪！" },
    { speaker: "宇航", text: "原来是场误会呀！哈哈哈，小家伙，你就是圆滚滚村的大英雄！" },
    { speaker: "宇航", text: "第一章·完 —— 这座岛的故事，才刚刚开始。" },
  ],
  bossLoseHint: [
    { speaker: "暗影胖胖王", text: "还差点火候哦！去练练级、买点奶瓶再来挑战吧。" },
  ],
};
