import {WebPlugin} from "../../../WagYourBotWeb";
import {NullData} from "./null.common";


class NullPlugin extends WebPlugin<NullData> {

}

export const plugin = new NullPlugin('null', 'null', {});