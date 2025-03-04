import { useState, useCallback, useEffect } from "react";
import styled from "styled-components";
import {
  EditorState,
  RichUtils,
  convertToRaw,
  getDefaultKeyBinding,
  ContentState,
  Modifier
} from "draft-js";
import Editor from "@draft-js-plugins/editor";
import createMentionPlugin, {
  defaultSuggestionsFilter
} from "@draft-js-plugins/mention";
import "emoji-mart/css/emoji-mart.css";
import "!style-loader!css-loader!draft-js-emoji-plugin/lib/plugin.css";
import "@draft-js-plugins/mention/lib/plugin.css";
import "!style-loader!css-loader!@draft-js-plugins/emoji/lib/plugin.css";
import "!style-loader!css-loader!@draft-js-plugins/mention/lib/plugin.css";

// import suggestionStyles from "./suggestions.module.css"
import "./message-editor-input.css";
import Toolbar from "./components/Toolbar";
import mentions from "./mentions.data";

import createEmojiPlugin from "@draft-js-plugins/emoji";
import { theme } from "./EmojiStyles.styled.js";

const emojiPlugin = createEmojiPlugin({
  useNativeArt: true,
  theme: theme
});
const { EmojiSuggestions, EmojiSelect } = emojiPlugin;

const mentionPlugin = createMentionPlugin({ mentionPrefix: "@" });
const { MentionSuggestions } = mentionPlugin;

function keyBindingFn(e) {
  if (e.code === "Enter") {
    if (e.shiftKey || e.nativeEvent.shiftKey) {
      return "newline";
    } else {
      return "send";
    }
  }
  return getDefaultKeyBinding(e);
}

// https://github.com/jpuri/draftjs-utils/blob/master/js/block.js
const removeSelectedBlocksStyle = editorState => {
  const newContentState = RichUtils.tryToRemoveBlockStyle(editorState);
  if (newContentState) {
    return EditorState.push(editorState, newContentState, "change-block-type");
  }
  return editorState;
};

// https://github.com/jpuri/draftjs-utils/blob/master/js/block.js
export const getResetEditorState = editorState => {
  const blocks = editorState.getCurrentContent().getBlockMap().toList();
  const updatedSelection = editorState.getSelection().merge({
    anchorKey: blocks.first().get("key"),
    anchorOffset: 0,
    focusKey: blocks.last().get("key"),
    focusOffset: blocks.last().getLength()
  });
  const newContentState = Modifier.removeRange(
    editorState.getCurrentContent(),
    updatedSelection,
    "forward"
  );

  const newState = EditorState.push(
    editorState,
    newContentState,
    "remove-range"
  );
  return removeSelectedBlocksStyle(newState);
};

const MessagePaneInput = ({ onSendMessage, users, onAttachFile }) => {
  const [data, setData] = useState("");
  const [editorState, setEditorState] = useState(() =>
    EditorState.createEmpty()
  );
  const [showEmoji, setShowEmoji] = useState(false);
  const [suggestions, setSuggestions] = useState(users || mentions);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  // console.log("field", editorState)
  // Mention helpers
  const onOpenChange = useCallback(_open => {
    setSuggestionsOpen(_open);
  }, []);

  const onSearchChange = useCallback(({ value }) => {
    setSuggestions(defaultSuggestionsFilter(value, mentions));
  }, []);

  const editorStates = editorState => {
    setEditorState(editorState);
    const blocks = convertToRaw(editorState.getCurrentContent()).blocks;
    const value = blocks
      .map(block => (!block.text.trim() && "\n") || block.text)
      .join("\n");
    setData(value);
  };

  const onChange = editorState => {
    editorStates(editorState);
  };

  const clearEditor = () => {
    setEditorState(getResetEditorState(editorState));
  };

  const sendMessage = contentState => {
    if (
      contentState.hasText() &&
      contentState.getPlainText().trim().length > 0
    ) {
      onSendMessage(convertToRaw(contentState));
      clearEditor();
    }
  };

  const handleKeyCommand = (command, editorState) => {
    const newState = RichUtils.handleKeyCommand(editorState, command);

    if (!newState) {
      if (command === "newline") {
        const newEditorState = RichUtils.insertSoftNewline(editorState);
        if (newEditorState !== editorState) {
          onChange(newEditorState);
        }
        return "handled";
      }
      if (command === "send") {
        sendMessage(editorState.getCurrentContent());
        return "handled";
      }
    }

    if (newState) {
      setEditorState(newState);
      return "handled";
    }
    return "not handled";
  };
  //Preview render
  const [sentAttachedFile, setSentAttachedFile] = useState(null);
  const [preview, setPreview] = useState("");

  useEffect(() => {
    if (sentAttachedFile) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(sentAttachedFile);
    } else {
      setPreview("");
    }
  }, [sentAttachedFile]);

  // on click clear attached file
  const clearAttached = () => {
    setSentAttachedFile("");
  };

  return (
    <Wrapper>
      <InputWrapper>
        {preview ? (
          <Preview>
            <img src={preview} alt="Image Preview" />
            <button
              style={{
                position: "absolute",
                top: "9px",
                left: "65px",
                height: "30px",
                width: "30px",
                borderRadius: "50%"
              }}
              onClick={clearAttached}
            >
              X
            </button>
          </Preview>
        ) : null}
        <div className="RichEditor-root">
          <Toolbar
            editorState={editorState}
            setEditorState={setEditorState}
            emojiSelect={<EmojiSelect />}
            sendMessageHandler={sendMessage}
            sendAttachedFileHandler={onAttachFile}
            sentAttachedFile={sentAttachedFile =>
              setSentAttachedFile(sentAttachedFile)
            }
          />
          <Editor
            editorState={editorState}
            onChange={onChange}
            handleKeyCommand={handleKeyCommand}
            keyBindingFn={keyBindingFn}
            plugins={[emojiPlugin, mentionPlugin]}
          />
        </div>
        <MentionSuggestions
          open={suggestionsOpen}
          onOpenChange={onOpenChange}
          onSearchChange={onSearchChange}
          suggestions={suggestions}
          // onAddMention={m => console.log(m)}
        />

        {/* <div>
          {showEmoji && (
            <Picker perLine={7} showPreview={false} onChange={true} />
          )}
        </div> */}
      </InputWrapper>
    </Wrapper>
  );
};

export default MessagePaneInput;

const Wrapper = styled.div`
  // padding: 0 10px;
  position: relative;
  display: flex;
  flex-direction: column;
  background-color: white;
  width: 100%;
`;

const InputWrapper = styled.section`
  border: 1px solid #b0afb0;
  ${"" /* border: 1px solid hsla(0, 0%, 92%, 1); */}
  border-radius: 3px;
  padding: 10px 18px 15px 18px;
  ${"" /* width: calc(100% - 24px); */}/* padding-left: 8px;
padding-top: 8px;
padding-bottom: 8px; */
  /* border-bottom: 1px solid hsl(160, 100%, 86%); */
`;
const SendWrapper = styled.section`
  display: flex;
  gap: 120px;
  align-items: center;
  padding-right: 18px;
  gap: 4px;
`;
const Input = styled.input`
  display: block;
  border: none;
  // padding: 18px 0 18px 12px;
  background-color: inherit;
  width: 100%;
  &:focus {
    border: none;
    outline: none;
  }
  &::placeholder {
    font-weight: 400;
    color: hsla(0, 0%, 75%, 1);
    font-size: ${15 / 16}rem;
  }
`;
const SendButton = styled.button`
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  background-color: hsl(160, 100%, 26%);
  color: white;
  font-weight: 700;
  font-size: 1rem;
`;
const Preview = styled.div`
  width: 5%;
  height: 0.05%;
  border-radius: 2px;

  img {
    object-fit: cover;
  }
`;
